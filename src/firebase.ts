import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Firebase 콘솔에서 프로젝트 설정 시 제공받는 값으로 교체
const firebaseConfig = {
  apiKey: "AIzaSyDXOPRaTmTIT6Rz9rQPD595n6TL8EHqap8",
  authDomain: "shuttle-cock-29463.firebaseapp.com",
  projectId: "shuttle-cock-29463",
  storageBucket: "shuttle-cock-29463.firebasestorage.app",
  messagingSenderId: "4122813639",
  appId: "1:4122813639:web:5525b4c16df34f5a980ae2",
  measurementId: "G-HHW9Y0JW53"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 데이터베이스(Firestore) 및 인증(Auth) 객체 내보내기
export const db = getFirestore(app);
export const auth = getAuth(app);

// 구글 로그인 프로바이더 설정
const googleProvider = new GoogleAuthProvider();

// 구글 로그인 팝업 호출 함수
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("구글 로그인 실패:", error);
    throw error;
  }
};

// 로그아웃 함수
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
};