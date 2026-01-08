import React, { useState, useEffect } from 'react';
import botsService from '../../services/bots';

const WheelTab = ({ botId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', weight: 10, winText: '' });

  useEffect(() => {
    loadWheelConfig();
  }, [botId]);

  const loadWheelConfig = async () => {
    try {
      setLoading(true);
      const config = await botsService.getWheelConfig(botId);
      setItems(config);
    } catch (error) {
      console.error('Ошибка загрузки конфигурации колеса:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await botsService.saveWheelConfig(botId, items);
      alert('Конфигурация колеса успешно сохранена!');
    } catch (error) {
      console.error('Ошибка сохранения конфигурации:', error);
      alert('Ошибка сохранения конфигурации');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!newItem.label.trim()) return;
    
    setItems([...items, { ...newItem, id: Date.now() }]);
    setNewItem({ label: '', weight: 10, winText: '' });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#f5bb5f] mx-auto"></div>
        <div className="text-gray-400 mt-2">Загрузка конфигурации...</div>
      </div>
    );
  }

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">Конфигурация колеса фортуны</h3>
      
      <div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">Добавить новый приз:</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            value={newItem.label}
            onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
            placeholder="Название приза"
            className="p-2 rounded bg-gray-700 border border-gray-600 text-white"
          />
          <input
            type="number"
            value={newItem.weight}
            onChange={(e) => setNewItem({ ...newItem, weight: parseInt(e.target.value) || 10 })}
            placeholder="Вес (вероятность)"
            className="p-2 rounded bg-gray-700 border border-gray-600 text-white"
            min="1"
            max="100"
          />
          <input
            type="text"
            value={newItem.winText}
            onChange={(e) => setNewItem({ ...newItem, winText: e.target.value })}
            placeholder="Текст поздравления"
            className="p-2 rounded bg-gray-700 border border-gray-600 text-white"
          />
        </div>
        <button
          onClick={addItem}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Добавить приз
        </button>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-gray-300">
            Всего призов: {items.length} | Общий вес: {totalWeight}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#f5bb5f] hover:bg-[#e6aa4e] text-black font-medium rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить конфигурацию'}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Нет призов. Добавьте первый приз.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-gray-400">#{index + 1}</div>
                    <div className="text-white font-medium">{item.label}</div>
                  </div>
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Удалить
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Вес (вероятность)</div>
                    <input
                      type="number"
                      value={item.weight}
                      onChange={(e) => updateItem(index, 'weight', parseInt(e.target.value) || 10)}
                      className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Шанс: {((item.weight / totalWeight) * 100).toFixed(1)}%</div>
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#f5bb5f] h-full"
                        style={{ width: `${(item.weight / totalWeight) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="text-sm text-gray-400 mb-1">Текст поздравления</div>
                  <textarea
                    value={item.winText}
                    onChange={(e) => updateItem(index, 'winText', e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                    rows="2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 p-4 bg-gray-900/30 rounded">
        <div className="font-medium text-gray-400 mb-2">Как работает система весов:</div>
        <ul className="space-y-1">
          <li>• Чем больше вес - тем выше вероятность выпадения приза</li>
          <li>• Вероятность рассчитывается как: (вес приза / сумма всех весов) * 100%</li>
          <li>• Рекомендуется использовать веса от 1 до 100</li>
          <li>• Общий вес всех призов: {totalWeight}</li>
        </ul>
      </div>
    </div>
  );
};

export default WheelTab;
