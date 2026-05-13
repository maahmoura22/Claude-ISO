import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@iso_history';

export async function saveHistoryEntry(entry) {
  try {
    const existing = await loadHistory();
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const updated = [newEntry, ...existing].slice(0, 100); // max 100 entries
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return newEntry;
  } catch (e) {
    console.error('Storage save error:', e);
    return null;
  }
}

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function clearHistory() {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Storage clear error:', e);
  }
}

export async function deleteHistoryEntry(id) {
  try {
    const existing = await loadHistory();
    const updated = existing.filter(e => e.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Storage delete error:', e);
  }
}
