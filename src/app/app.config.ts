import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideHttpClient } from '@angular/common/http';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { LIFIService } from './services/lifi/lifi.service';
import { MockLIFIService } from './services/lifi/lifi.service.mock';
import { HyperliquidService } from './services/hyperliquid/hyperliquid.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideIonicAngular({ mode: 'ios'}),
    // provideFirebaseApp(() =>
    //   initializeApp()
    // ),
    // provideAuth(() => getAuth()),
    // provideFirestore(() => getFirestore()),
    provideHttpClient(),
    {
      provide: 'EVM_SERVICE',
      // useClass: environment.isProd ? LIFIService : MockLIFIService,
      useClass: LIFIService,
    },
    {
      provide: 'HYPERLIQUID_SERVICE',
      useClass: HyperliquidService
    }
  ],
};
