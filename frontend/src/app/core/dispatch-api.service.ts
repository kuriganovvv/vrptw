import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { DayInput, Health, LoadResult, Plan, ReferenceData, UiDay } from './models';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});

/** Тонкая обёртка над REST API кейса. Все методы соответствуют OpenAPI-контракту. */
@Injectable({ providedIn: 'root' })
export class DispatchApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  health(): Observable<Health> {
    return this.http.get<Health>(`${this.baseUrl}/health`).pipe(timeout(4000));
  }

  listDays(): Observable<UiDay[]> {
    return this.http.get<UiDay[]>(`${this.baseUrl}/ui/days`).pipe(timeout(4000));
  }

  getDay(date: string): Observable<DayInput> {
    return this.http.get<DayInput>(`${this.baseUrl}/ui/days/${date}`).pipe(timeout(10_000));
  }

  getReference(): Observable<ReferenceData> {
    return this.http.get<ReferenceData>(`${this.baseUrl}/ui/reference`).pipe(timeout(10_000));
  }

  getPlan(date: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.baseUrl}/days/${date}/plan`).pipe(timeout(30_000));
  }

  postEvent(date: string, event: unknown): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/days/${date}/events`, event).pipe(timeout(10_000));
  }

  putReference(payload: unknown): Observable<LoadResult> {
    return this.http.put<LoadResult>(`${this.baseUrl}/reference`, payload).pipe(timeout(60_000));
  }

  putTravelMatrix(payload: unknown): Observable<LoadResult> {
    return this.http
      .put<LoadResult>(`${this.baseUrl}/reference/travel-matrix`, payload)
      .pipe(timeout(60_000));
  }

  putDay(date: string, payload: unknown): Observable<LoadResult> {
    return this.http.put<LoadResult>(`${this.baseUrl}/days/${date}`, payload).pipe(timeout(30_000));
  }
}
