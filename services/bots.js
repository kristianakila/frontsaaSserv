import api from './api';

class BotsService {
  // Получение ботов доступных текущему администратору
  async getAdminBots() {
    try {
      const adminId = localStorage.getItem('admin_id');
      
      // Загружаем доступные боты из Firestore через бэкенд
      const response = await api.post(`/admin/bots`, { adminId });
      return response.data.bots || [];
    } catch (error) {
      console.error('Ошибка получения ботов:', error);
      throw error;
    }
  }

  // Получение информации о конкретном боте
  async getBotInfo(botId) {
    try {
      const response = await api.get(`/bot/${botId}/info`);
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации о боте:', error);
      throw error;
    }
  }

  // Получение статистики бота
  async getBotStats(botId) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.get(`/admin/bot/${botId}/stats`, {
        params: { adminId }
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      throw error;
    }
  }

  // Получение пользователей бота
  async getBotUsers(botId, limit = 50, offset = 0) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.get(`/admin/bot/${botId}/users`, {
        params: { adminId, limit, offset }
      });
      return response.data.users || [];
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      throw error;
    }
  }

  // Получение конфигурации колеса бота
  async getWheelConfig(botId) {
    try {
      // Временная реализация - позже подключим бэкенд
      const response = await api.get(`/api/bot/${botId}/wheel-config`);
      return response.data.items || [];
    } catch (error) {
      console.error('Ошибка получения конфигурации колеса:', error);
      // Возвращаем дефолтные значения
      return this.getDefaultWheelConfig();
    }
  }

  // Сохранение конфигурации колеса
  async saveWheelConfig(botId, items) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.post(`/admin/bot/${botId}/wheel-config`, {
        adminId,
        items
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка сохранения конфигурации колеса:', error);
      throw error;
    }
  }

  // Отправка рассылки
  async sendBroadcast(botId, message, userIds = [], attachRefLink = false) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.post(`/admin/bot/${botId}/broadcast`, {
        adminId,
        message,
        userIds,
        attachRefLink
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка отправки рассылки:', error);
      throw error;
    }
  }

  // Получение списков лидов
  async getBotLeads(botId, limit = 50, offset = 0) {
    try {
      // Временная реализация
      return [];
    } catch (error) {
      console.error('Ошибка получения лидов:', error);
      return [];
    }
  }

  // Получение списков спинов
  async getBotSpins(botId, limit = 50, offset = 0) {
    try {
      // Временная реализация
      return [];
    } catch (error) {
      console.error('Ошибка получения спинов:', error);
      return [];
    }
  }

  // Дефолтная конфигурация колеса
  getDefaultWheelConfig() {
    return [
      { label: '100.000р на косметологию', weight: 10, winText: 'Вам очень повезло! Вы счастливчик!' },
      { label: 'Годовой абонемент на лазер', weight: 10, winText: 'Вам очень повезло! Вы счастливчик!' },
      { label: '-50% на лазерную эпиляцию', weight: 10, winText: 'Поздравляем! Вы выиграли 50% на лазерную эпиляцию!' },
      { label: 'Пилинг BioRePeel + маска', weight: 10, winText: 'Поздравляем, пилинг + маска в подарок!' },
      { label: 'Сеанс вибромассажа', weight: 10, winText: 'Ура! Процедура вибромассажа Ваша.' },
      { label: 'Бикини + подмышки + малая зона за 1890', weight: 10, winText: 'Поздравляем! Вы счастливый обладатель комплекса!' },
      { label: '50% сидка на ручной массаж', weight: 10, winText: 'Вау! Скидка -50% на ручной массаж, теперь Ваша.' },
      { label: 'Комбинированная чистка + маска в подарок', weight: 10, winText: 'Поздравляем! Вы выиграли!' },
      { label: 'Подмышки в подарок', weight: 10, winText: 'Ура! Вы выиграли процедуру лазерная эпиляция подмышечных впадин.' },
      { label: 'Сертификат на 1500р', weight: 10, winText: 'Вы счастливчик! Получаете подарочный сертификат!' }
    ];
  }

  // Создание нового бота
  async createBot(botData) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.post('/admin/bot/create', {
        adminId,
        ...botData
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка создания бота:', error);
      throw error;
    }
  }

  // Обновление настроек бота
  async updateBotSettings(botId, settings) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.post(`/admin/bot/${botId}/settings`, {
        adminId,
        ...settings
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка обновления настроек:', error);
      throw error;
    }
  }

  // Удаление бота
  async deleteBot(botId) {
    try {
      const adminId = localStorage.getItem('admin_id');
      const response = await api.post(`/admin/bot/${botId}/delete`, { adminId });
      return response.data;
    } catch (error) {
      console.error('Ошибка удаления бота:', error);
      throw error;
    }
  }

  // Проверка работоспособности API
  async checkHealth() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('API недоступен:', error);
      throw error;
    }
  }
}

export default new BotsService();
