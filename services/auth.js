import api from './api';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firestore';

class AuthService {
  // Вход через Firebase
  async login(email, password) {
    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Получаем данные пользователя из Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('Пользователь не найден в системе');
      }
      
      const userData = userDoc.data();
      
      // Проверяем, является ли пользователь администратором
      if (!userData.isAdmin) {
        throw new Error('Доступ только для администраторов');
      }
      
      // Сохраняем токен и ID пользователя
      const token = await user.getIdToken();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('admin_id', user.uid);
      
      return {
        uid: user.uid,
        email: user.email,
        ...userData
      };
    } catch (error) {
      console.error('Ошибка входа:', error);
      throw error;
    }
  }

  // Выход
  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_id');
    window.location.href = '/login';
  }

  // Проверка аутентификации
  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  }

  // Получение ID текущего администратора
  getCurrentAdminId() {
    return localStorage.getItem('admin_id');
  }
}

export default new AuthService();
