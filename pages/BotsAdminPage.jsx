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
                          Уда
