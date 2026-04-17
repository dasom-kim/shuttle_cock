import { initializeApp, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';

let app;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

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
