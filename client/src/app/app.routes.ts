import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CompetitionMainComponent } from './pages/competition-main/competition-main.component';
import { EventDetailComponent } from './pages/event-detail/event-detail.component';
import { CompetitionRecordComponent } from './pages/competition-record/competition-record.component';
import { CompetitionResultComponent } from './pages/competition-result/competition-result.component';
import { ImportComponent } from './pages/import/import.component';
import { authGuard } from './guards/auth.guard';
import { CompetitionEditComponent } from './pages/competition-edit/competition-edit.component';
import { CompetitionResultsOverviewComponent } from './pages/competition-results-overview/competition-results-overview.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard] 
  },
  { path: 'import',
    component: ImportComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'competition/:id', 
    component: CompetitionMainComponent, 
    canActivate: [authGuard] 
  },
  {
    path: 'competition/:id/record',
    component: CompetitionRecordComponent,
    canActivate: [authGuard]
  },
  {
    path: 'competition/:id/results-overview',
    component: CompetitionResultsOverviewComponent,
    canActivate: [authGuard]
  },
  {
    path: 'competition/event/:id/result',
    component: CompetitionResultComponent,
    canActivate: [authGuard]
  },
  {
   path: 'competition/edit/:id',
   component:CompetitionEditComponent,
   canActivate: [authGuard]
  },
  { 
    path: 'competition/:id/record', 
    component: CompetitionRecordComponent, 
    canActivate: [authGuard] 
  },
  {
    path: 'competition/edit/:id',
    component: CompetitionEditComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'event/:id', 
    component: EventDetailComponent, 
    canActivate: [authGuard] 
  },
  {
    path: 'competition/event/:id',
    component: EventDetailComponent,
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/dashboard' }
];
