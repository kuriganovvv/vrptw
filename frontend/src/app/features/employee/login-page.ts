import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { DispatchApiService } from '../../core/dispatch-api.service';
import { SessionStore } from '../../core/session-store';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, Icon],
  template: `
    <div class="login-bg relative min-h-screen overflow-hidden">
      <div class="login-grid pointer-events-none absolute inset-0"></div>

      <app-icon
        name="map-pin"
        class="pointer-events-none absolute left-[8%] top-[20%] size-7 text-brand-300"
      />
      <app-icon
        name="map-pin"
        class="pointer-events-none absolute right-[9%] top-[17%] size-6 text-brand-300"
      />
      <app-icon
        name="map-pin"
        class="pointer-events-none absolute right-[13%] top-[62%] size-5 text-brand-200"
      />

      <svg
        class="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full text-brand-200/70"
        viewBox="0 0 420 150"
        fill="currentColor"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect x="0" y="92" width="28" height="58" rx="2" />
        <rect x="34" y="72" width="22" height="78" rx="2" />
        <rect x="62" y="102" width="34" height="48" rx="2" />
        <rect x="104" y="60" width="18" height="90" rx="2" />
        <rect x="128" y="88" width="30" height="62" rx="2" />
        <path d="M186 150V64l10-38 10 38v86z" />
        <rect x="214" y="80" width="26" height="70" rx="2" />
        <rect x="246" y="100" width="36" height="50" rx="2" />
        <rect x="292" y="54" width="20" height="96" rx="2" />
        <rect x="318" y="84" width="28" height="66" rx="2" />
        <rect x="352" y="98" width="32" height="52" rx="2" />
        <rect x="390" y="76" width="24" height="74" rx="2" />
      </svg>

      <div class="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-12 pt-12">
        <div class="flex items-center justify-center gap-3">
          <svg viewBox="0 0 44 44" class="size-12 shrink-0" aria-hidden="true">
            <path fill="#5A2D82" d="M5 5h25.5L25 14.5H14.5V39H5z" />
            <path fill="#8B5CF6" d="M35.5 5H39v15.5L20.5 39 24 26l11.5-6.5z" />
          </svg>
          <span class="text-[28px] font-bold leading-none tracking-tight text-slate-900">
            Ростелеком
          </span>
        </div>
        <p class="mt-3 text-center text-sm leading-5 text-slate-500">
          Умная диспетчеризация<br />выездных бригад
        </p>

        <section
          class="mt-8 rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_18px_60px_-24px_rgba(90,45,130,0.45)] backdrop-blur"
        >
          <h1 class="text-[26px] font-bold tracking-tight text-slate-900">Вход в систему</h1>
          <p class="mt-1.5 text-sm leading-5 text-slate-500">
            Для продолжения введите свой staff_id. Пароль на демо-стенде не проверяется.
          </p>

          <form class="mt-5 space-y-3" (ngSubmit)="submit()">
            <div class="login-field">
              <app-icon name="user" class="login-field__icon" />
              <div class="min-w-0 flex-1">
                <span class="login-field__label">Роль</span>
                <span class="block text-sm font-medium text-slate-800">Сотрудник</span>
              </div>
              <app-icon name="chevron-down" class="size-4 text-slate-400" />
            </div>

            <label class="login-field">
              <app-icon name="user" class="login-field__icon" />
              <span class="min-w-0 flex-1">
                <span class="login-field__label">Логин (staff_id)</span>
                <input
                  name="staffId"
                  type="text"
                  inputmode="text"
                  autocomplete="username"
                  spellcheck="false"
                  placeholder="Например, ST-001"
                  class="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  [ngModel]="staffId()"
                  (ngModelChange)="staffId.set($event)"
                />
              </span>
            </label>

            <label class="login-field">
              <app-icon name="shield-check" class="login-field__icon" />
              <span class="min-w-0 flex-1">
                <span class="login-field__label">Пароль</span>
                <input
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="Введите пароль"
                  class="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  [ngModel]="password()"
                  (ngModelChange)="password.set($event)"
                />
              </span>
              <button
                type="button"
                class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                [attr.aria-label]="showPassword() ? 'Скрыть пароль' : 'Показать пароль'"
                (click)="showPassword.set(!showPassword())"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" class="size-4" />
              </button>
            </label>

            <p class="px-1 text-xs leading-4 text-slate-400">
              Пароль выдаётся администратором. Логин — это табельный номер сотрудника из справочника
              сервиса.
            </p>

            @if (error(); as message) {
              <div
                class="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-4 text-red-700"
                role="alert"
              >
                <app-icon name="triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                {{ message }}
              </div>
            }

            @if (notice(); as message) {
              <div
                class="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs leading-4 text-brand"
                role="status"
              >
                <app-icon name="info" class="mt-0.5 size-3.5 shrink-0" />
                {{ message }}
              </div>
            }

            <button
              type="submit"
              [disabled]="submitting()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-70"
            >
              @if (submitting()) {
                <app-icon name="refresh-cw" class="size-4 spin" />
                Проверяем…
              } @else {
                Войти
                <app-icon name="arrow-right" class="size-4" />
              }
            </button>
          </form>

          <button
            type="button"
            (click)="contactAdmin()"
            class="mt-4 w-full rounded-lg py-1 text-center text-xs font-medium text-brand transition-colors hover:text-brand-700"
          >
            Связаться с администратором
          </button>
        </section>

        <p class="mt-auto pt-8 text-center text-[11px] leading-4 text-slate-400">
          Мобильный кабинет сотрудника · данные поступают из сервиса планирования
        </p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .login-bg {
      background:
        radial-gradient(1000px 520px at 50% -12%, #e7ddf4 0%, transparent 62%),
        radial-gradient(760px 460px at 92% 108%, #ded4f0 0%, transparent 66%),
        #f5f3fa;
    }
    .login-grid {
      background-image:
        linear-gradient(to right, rgba(90, 45, 130, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(90, 45, 130, 0.05) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(90% 70% at 50% 40%, #000 0%, transparent 100%);
    }
    .login-field {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
      padding: 10px 14px;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }
    .login-field:focus-within {
      border-color: #5a2d82;
      box-shadow: 0 0 0 3px rgba(90, 45, 130, 0.12);
    }
    .login-field__icon {
      width: 20px;
      height: 20px;
      color: #64748b;
    }
    .login-field__label {
      display: block;
      font-size: 11px;
      line-height: 1.2;
      color: #64748b;
      margin-bottom: 2px;
    }
  `,
})
export class LoginPage {
  private readonly api = inject(DispatchApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly staffId = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    const value = this.staffId().trim().toUpperCase();
    this.notice.set(null);

    if (!/^ST-\d{3}$/.test(value)) {
      this.error.set('Логин — это staff_id вида ST-001. Проверьте номер и попробуйте снова.');
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    this.api
      .getReference()
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (reference) => {
          const staff = reference.staff.find(
            (item) => item.staff_id.toUpperCase() === value,
          );
          if (!staff) {
            this.error.set(`Сотрудник ${value} не найден в справочнике сервиса.`);
            return;
          }
          this.session.login(staff.staff_id);
          void this.router.navigate(['/app/shift']);
        },
        error: () => {
          this.error.set(
            'Не удалось проверить сотрудника: сервис планирования недоступен на localhost:8080.',
          );
        },
      });
  }

  protected contactAdmin(): void {
    this.error.set(null);
    this.notice.set(
      'Запросите доступ у диспетчера смены. В демо-версии вход выполняется по staff_id из справочника.',
    );
  }
}
