import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAueg9nquI8VWur_31ZRBphSrep70cR1bI',
  authDomain: 'lo-sugar-realtime.firebaseapp.com',
  databaseURL: 'https://lo-sugar-realtime-default-rtdb.firebaseio.com',
  projectId: 'lo-sugar-realtime',
  storageBucket: 'lo-sugar-realtime.firebasestorage.app',
  messagingSenderId: '713438142641',
  appId: '1:713438142641:web:560c5c672b5e4aa1b44290',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const rtdb = getDatabase(app);
