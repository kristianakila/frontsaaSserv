import React, { useState } from 'react';
import botsService from '../../services/bots';

const BotSettingsTab = ({ bot, onUpdateSettings }) => {
  const [form, setForm] = useState({
    name: bot?.name || '',
    botUsername: bot?.botUsername || '',
    subscriptionChannel: bot?.subscriptionChannel || '',
    leadsChannel: bot?.leadsChannel || '',
    requireSubscription: bot?.requireSubscription || true,
    baseAttempts: bot?.baseAttempts || 2,
    referralBonus: bot?.referralBonus || 2,
    status: bot?.status || 'active'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onUpdateSettings(form);
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">Основные настройки</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Название бота</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Username бота</label>
            <input
              type="text"
              value={form.botUsername}
              onChange={(e) => setForm(f => ({ ...f, botUsername: e.target.value }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">ID канала для подписки</label>
            <input
              type="text"
              value={form.subscriptionChannel}
              onChange={(e) => setForm(f => ({ ...f, subscriptionChannel: e.target.value }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              placeholder="-1001234567890"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">ID канала для лидов</label>
            <input
              type="text"
              value={form.leadsChannel}
              onChange={(e) => setForm(f => ({ ...f, leadsChannel: e.target.value }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              placeholder="-1001234567890"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Базовых попыток</label>
            <input
              type="number"
              value={form.baseAttempts}
              onChange={(e) => setForm(f => ({ ...f, baseAttempts: parseInt(e.target.value) || 2 }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              min="1"
              max="10"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Бонус за реферала</label>
            <input
              type="number"
              value={form.referralBonus}
              onChange={(e) => setForm(f => ({ ...f, referralBonus: parseInt(e.target.value) || 2 }))}
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              min="0"
              max="10"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requireSubscription"
              checked={form.requireSubscription}
              onChange={(e) => setForm(f => ({ ...f, requireSubscription: e.target.checked }))}
              className="w-4 h-4 text-[#f5bb5f] bg-gray-700 border-gray-600 rounded"
            />
            <label htmlFor="requireSubscription" className="text-sm text-gray-300">
              Требовать подписку
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={form.status}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
              className="p-2 rounded bg-gray-700 border border-gray-600 text-white"
            >
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
              <option value="maintenance">Тех. работы</option>
            </select>
          </div>
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BotSettingsTab;
