import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import * as L from 'leaflet';
import { DispatchStore } from '../../core/dispatch-store';
import { RouteView } from '../../core/models';
import { fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-routes-map',
  imports: [Icon],
  template: `
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
      >
        <div class="flex items-center gap-2">
          <app-icon name="route" class="size-4 text-brand" />
          <h2 class="text-sm font-semibold">Маршруты бригад</h2>
          <span class="text-xs text-slate-400">{{ routes().length }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          @for (route of routes().slice(0, 6); track route.staff.staff_id) {
            <button
              type="button"
              (click)="store.selectStaff(route.staff.staff_id)"
              class="inline-flex items-center gap-1.5 transition-colors hover:text-slate-900"
              [class.font-medium]="store.selectedStaffId() === route.staff.staff_id"
            >
              <span
                class="h-1.5 w-4 rounded-full"
                [style.background]="route.meta.color"
              ></span>
              {{ route.staff.display_name.split(' ')[1] }}
            </button>
          }
        </div>
      </div>

      <div class="relative min-h-[360px] flex-1 bg-slate-100 lg:min-h-[520px]">
        <div #mapEl class="absolute inset-0 z-0 h-full w-full"></div>

        @if (store.selectedRoute(); as route) {
          <div
            class="pointer-events-none absolute left-3 top-3 z-20 w-60 rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur"
          >
            <div class="flex items-center gap-2">
              <span
                class="size-2.5 rounded-full"
                [style.background]="route.meta.color"
              ></span>
              <span class="truncate font-semibold">{{ route.staff.display_name }}</span>
              <button
                type="button"
                (click)="store.selectStaff(null)"
                class="pointer-events-auto ml-auto rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Сбросить выбор"
              >
                <app-icon name="x" class="size-3.5" />
              </button>
            </div>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt class="text-slate-500">Статус</dt>
              <dd
                class="text-right font-medium"
                [class.text-red-600]="route.risk"
                [class.text-emerald-700]="!route.risk && route.presence === 'На заявке'"
              >
                {{ route.presence }}
              </dd>
              <dt class="text-slate-500">Прибытие</dt>
              <dd class="text-right font-medium">{{ route.eta ?? '—' }}</dd>
              <dt class="text-slate-500">Выполнено</dt>
              <dd class="text-right font-medium">{{ route.done }} из {{ route.visits }}</dd>
              <dt class="text-slate-500">Пробег</dt>
              <dd class="text-right font-medium">
                {{ route.km.toFixed(1).replace('.', ',') }} км
              </dd>
            </dl>
            @if (route.nextStop?.order; as order) {
              <div class="mt-2 border-t border-slate-100 pt-2">
                <div class="text-[10px] uppercase tracking-wide text-slate-400">
                  Следующая точка
                </div>
                <div class="mt-0.5 truncate text-xs text-slate-600" [title]="order.address">
                  {{ order.address }}
                </div>
              </div>
            }
            @if (route.risk) {
              <div class="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                <app-icon name="alarm-clock" class="size-3.5" />
                Не успевает в окно клиента
              </div>
            }
          </div>
        }

        <div
          class="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 backdrop-blur"
        >
          <span class="size-2.5 rounded bg-brand"></span>
          Сервисные центры · сейчас {{ nowLabel() }}
        </div>
      </div>
    </div>
  `,
})
export class RoutesMap implements AfterViewInit, OnDestroy {
  protected readonly store = inject(DispatchStore);

  @ViewChild('mapEl', { static: true }) private mapEl!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private layer?: L.LayerGroup;
  private fitted = false;

  protected readonly routes = this.store.activeRoutes;
  protected readonly nowLabel = () => fmtTime(this.store.now());

  constructor() {
    effect(() => {
      const routes = this.store.routes();
      const selected = this.store.selectedStaffId();
      if (!this.map) return;
      this.render(routes, selected);
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [56.8389, 60.6057],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 60);
    this.render(this.store.routes(), this.store.selectedStaffId());
    roadListeners.add(this.rerender);
  }

  ngOnDestroy(): void {
    roadListeners.delete(this.rerender);
    this.map?.remove();
    this.map = undefined;
  }

  /** Перерисовать, когда подъехала дорожная геометрия очередного маршрута. */
  private readonly rerender = () => this.render(this.store.routes(), this.store.selectedStaffId());

  private render(routes: RouteView[], selectedId: string | null): void {
    if (!this.map || !this.layer) return;
    this.layer.clearLayers();

    const active = routes.filter((r) => r.visits > 0);
    const ordered = [
      ...active.filter((r) => r.staff.staff_id !== selectedId),
      ...active.filter((r) => r.staff.staff_id === selectedId),
    ];

    const bounds = L.latLngBounds([]);

    for (const view of ordered) {
      const isSelected = view.staff.staff_id === selectedId;
      const dim = selectedId !== null && !isSelected;
      const color = view.meta.color;

      const points: L.LatLngTuple[] = [];
      const coords: MapPoint[] = [];
      let previous: string | null = null;
      for (const stopView of view.stops) {
        const key = `${stopView.lat.toFixed(5)}:${stopView.lon.toFixed(5)}`;
        if (key === previous) continue;
        previous = key;
        points.push([stopView.lat, stopView.lon]);
        coords.push({ lat: stopView.lat, lon: stopView.lon });
        bounds.extend([stopView.lat, stopView.lon]);
      }

      if (points.length > 1) {
        const geometryKeyValue = geometryKey(coords);
        const road = roadGeometry.get(geometryKeyValue);
        // Пока дорожная геометрия не получена — пунктирная прямая между точками.
        const shape: L.LatLngExpression[] = road ?? points;

        L.polyline(shape, {
          color: '#ffffff',
          weight: isSelected ? 11 : 9,
          opacity: dim ? 0.15 : 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(this.layer);

        const line = L.polyline(shape, {
          color,
          weight: isSelected ? 6 : 4,
          opacity: dim ? 0.15 : 1,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: road ? undefined : '7 8',
          className: 'route-line',
        }).addTo(this.layer);
        line.on('click', () => this.store.selectStaff(view.staff.staff_id));
        line.bindTooltip(
          `<b>${view.staff.display_name}</b><br/>${view.visits} визитов · ${view.km
            .toFixed(1)
            .replace('.', ',')} км`,
          { sticky: true, direction: 'top', opacity: 1 },
        );

        if (!road) requestRoadGeometry(geometryKeyValue, coords);
      }

      for (const stopView of view.stops) {
        if (stopView.stop.type !== 'VISIT') continue;
        const order = stopView.order;
        const done = stopView.stop.status === 'DONE';
        const activeNow = stopView.stop.status === 'IN_PROGRESS';
        const fill = done || activeNow ? color : '#ffffff';
        const text = done || activeNow ? '#ffffff' : color;
        const marker = L.marker([stopView.lat, stopView.lon], {
          icon: L.divIcon({
            className: `stop-marker ${dim ? 'stop-marker--dim' : 'stop-marker--active'}`,
            html: `<div style="
              width:22px;height:22px;border-radius:9999px;
              background:${fill};border:2.5px solid ${color};
              color:${text};font-weight:700;font-size:10px;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 0 3px #fff, 0 2px 6px rgba(15,23,42,.25);
              font-family:Geist, system-ui, sans-serif;
            ">${stopView.stop.seq}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          keyboard: false,
          zIndexOffset: isSelected ? 1000 : 0,
        }).addTo(this.layer);

        marker.on('click', () => this.store.selectStaff(view.staff.staff_id));
        marker.bindTooltip(
          `<b>${order ? order.address : stopView.stop.location_id}</b><br/>
          ${view.staff.display_name} · ${stopView.timeLabel}<br/>
          <span style="color:#64748b">${
            stopView.stop.status === 'DONE' ? 'Выполнено'
            : stopView.late ? 'Риск опоздания'
            : 'Запланировано'
          }</span>${
            stopView.stop.explanation?.includes('Совместный')
              ? '<br/><span style="color:#F97316">👥 Совместный визит (2 сотрудника)</span>'
              : ''
          }`,
          { direction: 'top', offset: [0, -12], opacity: 1 },
        );
      }

      const depot = view.stops.find((s) => s.stop.type === 'DEPOT_START');
      if (depot) {
        L.marker([depot.lat, depot.lon], {
          icon: L.divIcon({
            className: 'stop-marker',
            html: `<div style="
              width:26px;height:26px;border-radius:8px;background:#5A2D82;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.3);
              display:flex;align-items:center;justify-content:center;color:#fff;
            "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          keyboard: false,
          zIndexOffset: 500,
        })
          .addTo(this.layer)
          .bindTooltip(`${view.route.service_center_id} · база бригады`, {
            direction: 'top',
            offset: [0, -14],
          });
      }
    }

    if (!this.fitted && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [46, 46], maxZoom: 13 });
      this.fitted = true;
    }
  }
}

interface MapPoint {
  lat: number;
  lon: number;
}

/** Дорожная геометрия: OSRM отдаёт её по тем же координатам, что и точки маршрута. */
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
/**
 * `continue_straight=false` разрешает разворот на промежуточной точке.
 * Без него OSRM отвечает `NoRoute`, если маршрут требует разворота через
 * разделитель/одностороннюю улицу (например, маршрут ST-008), и линия
 * остаётся пунктирной прямой.
 */
const OSRM_QUERY = 'continue_straight=false&overview=full&geometries=geojson';
const OSRM_TIMEOUT_MS = 15_000;
const ROAD_RETRY_MS = 60_000;

const roadGeometry = new Map<string, L.LatLngTuple[]>();
const roadFailedAt = new Map<string, number>();
const roadQueue: { key: string; points: MapPoint[] }[] = [];
const roadListeners = new Set<() => void>();
let roadBusy = false;

function geometryKey(points: MapPoint[]): string {
  return points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');
}

function requestRoadGeometry(key: string, points: MapPoint[]): void {
  if (roadGeometry.has(key)) return;
  const failedAt = roadFailedAt.get(key);
  if (failedAt !== undefined && Date.now() - failedAt < ROAD_RETRY_MS) return;
  if (roadQueue.some((job) => job.key === key)) return;
  roadQueue.push({ key, points });
  pumpRoadQueue();
}

interface OsrmRouteBody {
  code?: string;
  routes?: { geometry?: { coordinates?: [number, number][] } }[];
}

async function fetchRoadLine(points: MapPoint[]): Promise<L.LatLngTuple[]> {
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(`${OSRM_URL}/${coords}?${OSRM_QUERY}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as OsrmRouteBody;
    const line = body.routes?.[0]?.geometry?.coordinates;
    if (!line?.length) throw new Error(body.code ?? 'no geometry');
    return line.map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Резервный вариант: собираем маршрут из отдельных участков между соседними точками. */
async function fetchRoadByLegs(points: MapPoint[]): Promise<L.LatLngTuple[]> {
  const line: L.LatLngTuple[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const leg = await fetchRoadLine([points[i], points[i + 1]]);
    line.push(...(i === 0 ? leg : leg.slice(1)));
  }
  if (!line.length) throw new Error('empty route');
  return line;
}

/** Публичный OSRM не любит всплески запросов: по одному с паузой. */
function pumpRoadQueue(): void {
  if (roadBusy) return;
  const job = roadQueue.shift();
  if (!job) return;
  if (roadGeometry.has(job.key)) {
    pumpRoadQueue();
    return;
  }
  roadBusy = true;
  fetchRoadLine(job.points)
    .catch(() => fetchRoadByLegs(job.points))
    .then((line) => {
      roadGeometry.set(job.key, line);
      roadFailedAt.delete(job.key);
      roadListeners.forEach((listener) => listener());
    })
    .catch(() => {
      // маршрутизатор недоступен — остаёмся на пунктирной прямой,
      // но не повторяем запрос на каждой перерисовке карты
      roadFailedAt.set(job.key, Date.now());
    })
    .finally(() => {
      roadBusy = false;
      window.setTimeout(pumpRoadQueue, 700);
    });
}
