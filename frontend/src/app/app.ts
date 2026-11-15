import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DispatchStore } from './core/dispatch-store';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(DispatchStore);
}
