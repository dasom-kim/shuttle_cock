import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDXOPRaTmTIT6Rz9rQPD595n6TL8EHqap8",
    authDomain: "shuttle-cock-29463.firebaseapp.com",
    projectId: "shuttle-cock-29463",
    storageBucket: "shuttle-cock-29463.firebasestorage.app",
    messagingSenderId: "4122813639",
    appId: "1:4122813639:web:5525b4c16df34f5a980ae2",
    measurementId: "G-HHW9Y0JW53"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 구글 팝업 로그인 함수
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
// 로그아웃 함수
export const logout = () => signOut(auth);