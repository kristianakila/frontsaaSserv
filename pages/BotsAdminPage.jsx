import React, { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../firebase/firestore";
import { doc, getDoc, getDocs, collection, addDoc, setDoc, deleteDoc } from "firebase/firestore";
import BotSettingsTab from "../Components/admin/BotSettingsTab";
import WheelTab from "../Components/admin/WheelTab";
import UsersTab from "../Components/admin/UsersTab";
import ConfirmModal from "../Components/admin/ConfirmModal";
import botsService from "../services/bots";
import authService from "../services/auth";

const BotsAdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(null);
  const [bot, setBot] = useState(null);
  const [botsList, setBotsList] = useState([]);
  const [activeTab, setActiveTab] = useState("settings");
  const [expandedBot, setExpandedBot] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    botId: null,
    botName: ""
  });
  const [botStats, setBotStats] = useState({});

  const loadContext = useCallback(async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError("Требуется авторизация");
        authService.logout();
        return;
      }

      // Проверяем, является ли пользователь администратором
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        setError("Пользователь не найден");
        authService.logout();
        return;
      }

      const userData = userDoc.data();
      
      if (!userData.isAdmin) {
        setError("Доступ только для администраторов");
        authService.logout();
        return;
      }

      setAdmin(userData);

      // Получаем ботов, доступных этому администратору
      let accessibleBots = [];
      
      if (userData.accessibleBots && Array.isArray(userData.accessibleBots)) {
        // Если есть явный список доступных ботов
        const botsPromises = userData.accessibleBots.map(async (botId) => {
          try {
            const botDoc = await getDoc(doc(db, "bots", botId));
            if (botDoc.exists()) {
              return { id: botDoc.id, ...botDoc.data() };
            }
          } catch (err) {
            console.error(`Ошибка загрузки бота ${botId}:`, err);
            return null;
          }
        });
        
        const botsResults = await Promise.all(botsPromises);
        accessibleBots = botsResults.filter(bot => bot !== null);
      } else {
        // Иначе загружаем все боты (для суперадмина)
        const botsSnapshot = await getDocs(collection(db, "bots"));
        accessibleBots = botsSnapshot.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date()
        }));
      }

      // Сортируем по дате создания
      accessibleBots.sort((a, b) => b.createdAt - a.createdAt);
      
      setBotsList(accessibleBots);

      // Не загружаем бота автоматически - всегда показываем список
      setBot(null);
      setExpandedBot(null);
      
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем статистику для выбранного бота
  const loadBotStats = async (botId) => {
    try {
      const stats = await botsService.getBotStats(botId);
      setBotStats(prev => ({
        ...prev,
        [botId]: stats
      }));
    } catch (err) {
      console.error("Ошибка загрузки статистики:", err);
    }
  };

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const handleBotSelect = async (botItem) => {
    try {
      // Сохраняем выбор бота для пользователя
      if (admin) {
        await setDoc(doc(db, "users", getAuth().currentUser.uid), {
          ...admin,
          selectedBotId: botItem.id
        }, { merge: true });
      }
      
      // Загружаем дополнительную информацию о боте из бэкенда
      const botInfo = await botsService.getBotInfo(botItem.id);
      
      // Загружаем статистику
      await loadBotStats(botItem.id);
      
      setBot({
        ...botItem,
        ...botInfo
      });
      setExpandedBot(null); // Закрываем список при выборе
      setActiveTab("settings"); // Переходим на вкладку настроек
    } catch (err) {
      console.error("Ошибка при выборе бота:", err);
      setError("Ошибка при загрузке бота");
    }
  };

  const toggleBotExpand = (botId) => {
    setExpandedBot(expandedBot === botId ? null : botId);
  };

  const handleCreateBot = async (formData) => {
    try {
      // Создаем бота в Firestore
      const botRef = await addDoc(collection(db, "bots"), {
        name: formData.name.trim(),
        botUsername: formData.username.trim().replace("@", ""),
        botToken: formData.token.trim(),
        subscriptionChannel: formData.channel || "",
        leadsChannel: formData.leadsChannel || "",
        requireSubscription: formData.requireSubscription || true,
        baseAttempts: 2,
        referralBonus: 2,
        status: "active",
        createdAt: new Date(),
        createdBy: getAuth().currentUser.uid
      });

      // Добавляем бота в список доступных для администратора
      const adminRef = doc(db, "users", getAuth().currentUser.uid);
      const adminDoc = await getDoc(adminRef);
      const adminData = adminDoc.data();
      
      const accessibleBots = [...(adminData.accessibleBots || []), botRef.id];
      await setDoc(adminRef, {
        ...adminData,
        accessibleBots
      }, { merge: true });

      // Автоматически выбираем нового бота
      const botSnap = await getDoc(botRef);
      if (botSnap.exists()) {
        await handleBotSelect({ id: botSnap.id, ...botSnap.data() });
      }

      setShowCreateModal(false);
      loadContext(); // Обновляем список ботов
    } catch (err) {
      console.error("Ошибка создания бота:", err);
      alert("Не удалось создать бота");
    }
  };

  const openDeleteModal = (botId, botName) => {
    setDeleteModal({
      isOpen: true,
      botId,
      botName
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, botId: null, botName: "" });
  };

  const handleDeleteBot = async () => {
    if (!deleteModal.botId) return;
    
    try {
      if (deleteModal.botId === bot?.id) {
        setBot(null); // Сбрасываем текущего бота если удаляем его
      }

      // Удаляем бота из Firestore
      await deleteDoc(doc(db, "bots", deleteModal.botId));
      
      // Удаляем бота из списка доступных для администратора
      if (admin) {
        const adminRef = doc(db, "users", getAuth().currentUser.uid);
        const accessibleBots = (admin.accessibleBots || []).filter(id => id !== deleteModal.botId);
        await setDoc(adminRef, {
          ...admin,
          accessibleBots
        }, { merge: true });
      }
      
      closeDeleteModal();
      loadContext();
    } catch (err) {
      console.error("Ошибка удаления бота:", err);
      alert("Не удалось удалить бота");
      closeDeleteModal();
    }
  };

  const updateBotSettings = async (settings) => {
    if (!bot) return;
    
    try {
      await botsService.updateBotSettings(bot.id, settings);
      
      // Обновляем локальное состояние
      setBot(prev => ({
        ...prev,
        ...settings
      }));
      
      alert("Настройки успешно сохранены!");
    } catch (err) {
      console.error("Ошибка сохранения настроек:", err);
      alert("Ошибка сохранения настроек");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Если выбран бот - показываем управление им
  if (bot) {
    const stats = botStats[bot.id] || {};

    return (
      <div className="w-full min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
        {/* Компактная панель управления */}
        <div className="p-4 max-w-7xl mx-auto">
          {/* Заголовок и кнопка возврата к списку */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setBot(null);
                  setExpandedBot(null);
                }}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                title="Вернуться к списку ботов"
              >
                ← Все боты
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">{bot.name}</h1>
                <div className="text-sm text-gray-400">@{bot.botUsername}</div>
                {bot.status && (
                  <div className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
                    bot.status === 'active' 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {bot.status === 'active' ? 'Активен' : 'Неактивен'}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded-lg text-sm transition-colors"
              >
                + Новый бот
              </button>
            </div>
          </div>

          {/* Мини-статистика в строку */}
          <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg min-w-fit">
              <div className="text-gray-400">👥</div>
              <div>
                <div className="text-xs text-gray-400">Пользователи</div>
                <div className="text-sm font-medium text-white">
                  {stats.totalUsers || bot.usersCount || 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg min-w-fit">
              <div className="text-gray-400">🎡</div>
              <div>
                <div className="text-xs text-gray-400">Кручений</div>
                <div className="text-sm font-medium text-white">
                  {stats.totalSpins || 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg min-w-fit">
              <div className="text-gray-400">📥</div>
              <div>
                <div className="text-xs text-gray-400">Лидів</div>
                <div className="text-sm font-medium text-white">
                  {stats.totalLeads || 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg min-w-fit">
              <div className="text-gray-400">📈</div>
              <div>
                <div className="text-xs text-gray-400">Актив. за 7 дн.</div>
                <div className="text-sm font-medium text-white">
                  {stats.spinsLast7Days || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Табы */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          
          {/* Содержимое таба */}
          <div className="mt-6">
            <TabContent 
              activeTab={activeTab} 
              bot={bot} 
              botId={bot.id}
              onUpdateSettings={updateBotSettings}
            />
          </div>
        </div>

        {/* Модальные окна */}
        <CreateBotModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBot}
        />

        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteBot}
          title="Удалить бота?"
          message={`Бот "${deleteModal.botName}" будет удален вместе со всеми данными. Это действие нельзя отменить.`}
          confirmText="Удалить навсегда"
          cancelText="Отмена"
          type="danger"
        />
      </div>
    );
  }

  // Главная страница - список доступных ботов
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="p-4 max-w-4xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Мои боты</h1>
          <p className="text-gray-400">Выберите бота для управления или создайте новый</p>
          <div className="text-sm text-gray-500 mt-2">
            Доступно ботов: {botsList.length}
          </div>
        </div>

        {/* Кнопка создания */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>Создать нового бота</span>
          </button>
        </div>

        {/* Список доступных ботов */}
        <div className="space-y-2">
          {botsList.length === 0 ? (
            <EmptyState onCreateBot={() => setShowCreateModal(true)} />
          ) : (
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">
                Нажмите на бота для управления:
              </div>
              {botsList.map((botItem) => (
                <div
                  key={botItem.id}
                  className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden transition-all hover:border-gray-600/50 mb-2"
                >
                  {/* Основная строка бота */}
                  <div
                    className="p-3 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleBotExpand(botItem.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f5bb5f]/20 flex items-center justify-center">
                        <span className="text-[#f5bb5f]">🤖</span>
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {botItem.name}
                          {botItem.status === 'active' && (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">@{botItem.botUsername}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500">
                        {botItem.createdAt.toLocaleDateString('ru-RU')}
                      </div>
                      <div className={`transform transition-transform ${expandedBot === botItem.id ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Раскрывающаяся часть с действиями */}
                  {expandedBot === botItem.id && (
                    <div className="border-t border-gray-700/50 p-3 bg-gray-800/20 animate-slideDown">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button
                          onClick={() => handleBotSelect(botItem)}
                          className="px-4 py-2 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded-lg text-sm transition-colors flex-1 min-w-[120px]"
                        >
                          Управлять ботом
                        </button>
                        <button
                          onClick={() => openDeleteModal(botItem.id, botItem.name)}
                          className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 rounded-lg text-sm transition-colors flex-1 min-w-[120px]"
                        >
                          Удалить бота
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="text-center p-2 bg-gray-800/30 rounded">
                          <div className="text-gray-400">Пользователи</div>
                          <div className="text-white font-medium">{botItem.usersCount || 0}</div>
                        </div>
                        <div className="text-center p-2 bg-gray-800/30 rounded">
                          <div className="text-gray-400">Призы</div>
                          <div className="text-white font-medium">{botItem.wheelItemsCount || 0}</div>
                        </div>
                        <div className="text-center p-2 bg-gray-800/30 rounded">
                          <div className="text-gray-400">Статус</div>
                          <div className={`font-medium ${
                            botItem.status === 'active' ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {botItem.status === 'active' ? 'Активен' : 'Неактивен'}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-gray-800/30 rounded">
                          <div className="text-gray-400">Создан</div>
                          <div className="text-gray-400">{botItem.createdAt.toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Информация внизу */}
        {botsList.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Всего доступно ботов: {botsList.length} • Нажмите на бота для просмотра действий
          </div>
        )}

        {/* Модальное окно создания бота */}
        <CreateBotModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBot}
        />

        {/* Модальное окно подтверждения удаления */}
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteBot}
          title="Удалить бота?"
          message={`Бот "${deleteModal.botName}" будет удален вместе со всеми данными. Это действие нельзя отменить.`}
          confirmText="Удалить навсегда"
          cancelText="Отмена"
          type="danger"
        />
      </div>
    </div>
  );
};

// ===== ДОПОЛНИТЕЛЬНЫЕ КОМПОНЕНТЫ =====

const CreateBotModal = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: "",
    username: "",
    token: "",
    channel: "",
    leadsChannel: "",
    requireSubscription: true
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.token.trim()) {
      alert("Заполните обязательные поля");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm({
        name: "",
        username: "",
        token: "",
        channel: "",
        leadsChannel: "",
        requireSubscription: true
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl p-6 max-w-md w-full border border-gray-800 shadow-2xl animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Создать нового бота</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Название бота *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full p-3 rounded-lg bg-gray-800/50 text-white border border-gray-700 focus:border-[#f5bb5f] focus:outline-none transition-colors"
              placeholder="Мой телеграм бот"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Telegram username *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                @
              </span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full pl-8 p-3 rounded-lg bg-gray-800/50 text-white border border-gray-700 focus:border-[#f5bb5f] focus:outline-none transition-colors"
                placeholder="username_bot"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Telegram Bot Token *
            </label>
            <input
              type="text"
              value={form.token}
              onChange={(e) => setForm(f => ({ ...f, token: e.target.value }))}
              className="w-full p-3 rounded-lg bg-gray-800/50 text-white border border-gray-700 focus:border-[#f5bb5f] focus:outline-none transition-colors"
              placeholder="1234567890:ABCDEF..."
              required
            />
            <div className="text-xs text-gray-500 mt-2">
              Получите у @BotFather
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Канал для подписки (ID)
            </label>
            <input
              type="text"
              value={form.channel}
              onChange={(e) => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full p-3 rounded-lg bg-gray-800/50 text-white border border-gray-700 focus:border-[#f5bb5f] focus:outline-none transition-colors"
              placeholder="-1001234567890"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Канал для лидов (ID)
            </label>
            <input
              type="text"
              value={form.leadsChannel}
              onChange={(e) => setForm(f => ({ ...f, leadsChannel: e.target.value }))}
              className="w-full p-3 rounded-lg bg-gray-800/50 text-white border border-gray-700 focus:border-[#f5bb5f] focus:outline-none transition-colors"
              placeholder="-1001234567890"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="requireSubscription"
              checked={form.requireSubscription}
              onChange={(e) => setForm(f => ({ ...f, requireSubscription: e.target.checked }))}
              className="w-4 h-4 text-[#f5bb5f] bg-gray-700 border-gray-600 rounded focus:ring-[#f5bb5f]"
            />
            <label htmlFor="requireSubscription" className="text-sm text-gray-300">
              Требовать подписку на канал для участия
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded-lg transition-colors flex-1 disabled:opacity-50"
            >
              {submitting ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Остальные компоненты остаются без изменений...
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f5bb5f]"></div>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="flex justify-center items-center h-screen">
    <div className="p-6 max-w-lg bg-red-900/20 border border-red-800 rounded-lg">
      <div className="text-red-300 font-semibold mb-2">Ошибка</div>
      <div className="text-white">{message}</div>
      <button
        onClick={() => window.location.href = '/login'}
        className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
      >
        Войти снова
      </button>
    </div>
  </div>
);

const EmptyState = ({ onCreateBot }) => (
  <div className="text-center py-12">
    <div className="w-20 h-20 rounded-full bg-[#f5bb5f]/10 flex items-center justify-center mx-auto mb-6">
      <span className="text-4xl">🤖</span>
    </div>
    <h2 className="text-xl font-bold text-white mb-3">Нет доступных ботов</h2>
    <p className="text-gray-400 mb-8 max-w-md mx-auto">
      Создайте своего первого Telegram бота для управления розыгрышами и пользователями
    </p>
    <button
      onClick={onCreateBot}
      className="px-6 py-3 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded-lg transition-colors"
    >
      Создать первого бота
    </button>
  </div>
);

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: "settings", label: "Настройки", icon: "⚙️" },
    { id: "wheel", label: "Колесо", icon: "🎡" },
    { id: "users", label: "Пользователи", icon: "👥" }
  ];

  return (
    <div className="flex gap-1 p-1 bg-gray-800/30 rounded-lg inline-flex">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 text-sm ${
            activeTab === tab.id 
              ? "bg-[#f5bb5f] text-black shadow" 
              : "text-gray-400 hover:text-white hover:bg-gray-700/50"
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const TabContent = ({ activeTab, bot, botId, onUpdateSettings }) => {
  const components = {
    settings: <BotSettingsTab bot={bot} onUpdateSettings={onUpdateSettings} />,
    wheel: <WheelTab botId={botId} />,
    users: <UsersTab botId={botId} />
  };
  
  return (
    <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/50">
      {components[activeTab]}
    </div>
  );
};

export default BotsAdminPage;
