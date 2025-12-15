import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import { collection, doc, getDoc, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';

// Chaves de armazenamento para preferências
const STORAGE_KEYS = {
  mealReminders: 'prefs_meal_reminders_enabled',
  waterReminders: 'prefs_water_reminders_enabled',
  mealScheduleIds: 'prefs_meal_reminder_ids',
  waterScheduleIds: 'prefs_water_reminder_ids',
};

// Horários de lembrete (24h) – apenas se não houver registo no dia
const REMINDER_TIMES = {
  meal: [{ hour: 14, minute: 0 }],
  water: [{ hour: 17, minute: 0 }],
};

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function registerNotificationHandlers(): void {
  // Abrir app ao tocar (placeholder para deeplinks futuros)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function getDeviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    const code = locale.split('-')[0].toLowerCase();
    const supported = ['en', 'pt', 'es', 'fr', 'de', 'it'];
    return supported.includes(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

function getStrings() {
  const lang = getDeviceLanguage();
  const texts: Record<string, { title: string; body: string }> = {
    meal_en: { title: 'Meal Reminder', body: "You haven't logged any meal today. Add one?" },
    meal_pt: { title: 'Hora da refeição', body: 'Ainda não registaste nenhuma refeição hoje. Queres adicionar?' },
    meal_es: { title: 'Recordatorio de comida', body: 'Aún no has registrado ninguna comida hoy. ¿Quieres añadir una?' },
    meal_fr: { title: 'Rappel repas', body: "Vous n'avez enregistré aucun repas aujourd'hui. Ajouter?" },
    meal_de: { title: 'Mahlzeit-Erinnerung', body: 'Du hast heute noch keine Mahlzeit erfasst. Möchtest du eine hinzufügen?' },
    meal_it: { title: 'Promemoria pasto', body: 'Non hai registrato alcun pasto oggi. Vuoi aggiungerne uno?' },

    water_en: { title: 'Drink Water', body: "You haven't updated your water today. Log it now!" },
    water_pt: { title: 'Lembrar de beber água', body: 'Ainda não atualizaste a água ingerida hoje. Regista agora!' },
    water_es: { title: 'Bebe agua', body: 'Aún no has actualizado el agua ingerida hoy. ¡Regístralo ahora!' },
    water_fr: { title: "Bois de l'eau", body: "Tu n'as pas mis à jour ton eau aujourd'hui. Enregistre maintenant !" },
    water_de: { title: 'Wasser trinken', body: 'Du hast dein Wasser heute nicht aktualisiert. Jetzt eintragen!' },
    water_it: { title: 'Bevi acqua', body: "Non hai aggiornato l'acqua di oggi. Registra ora!" },

    badge_en: { title: 'Badge unlocked!', body: 'Congrats! You earned a new badge.' },
    badge_pt: { title: 'Badge desbloqueado!', body: 'Parabéns! Ganhou um novo badge.' },
    badge_es: { title: '¡Insignia desbloqueada!', body: '¡Felicidades! Has ganado una nueva insignia.' },
    badge_fr: { title: 'Badge débloqué !', body: 'Bravo ! Nouveau badge gagné.' },
    badge_de: { title: 'Abzeichen freigeschaltet!', body: 'Glückwunsch! Neues Abzeichen erhalten.' },
    badge_it: { title: 'Badge sbloccato!', body: 'Congratulazioni! Hai guadagnato un nuovo badge.' },
  };

  return {
    meal: texts[`meal_${lang}`],
    water: texts[`water_${lang}`],
    badge: texts[`badge_${lang}`],
  };
}
function buildDateTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
  const now = new Date();
  const triggerDate = new Date();
  triggerDate.setHours(hour, minute, 0, 0);

  // Se o horário já passou hoje, agenda para amanhã
  if (triggerDate.getTime() <= now.getTime()) {
    triggerDate.setDate(triggerDate.getDate() + 1);
  }

  const trigger: Notifications.NotificationTriggerInput = {
    type: 'date',
    date: triggerDate,
    // channelId recomendado no Android
    channelId: Platform.OS === 'android' ? 'default' : undefined,
  } as Notifications.NotificationTriggerInput;

  return trigger;
}

async function cancelById(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // ignore
  }
}

function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function hasMealsToday(userId: string): Promise<boolean> {
  const { start, end } = todayRange();
  const mealsRef = collection(db, 'meals');
  const q = query(
    mealsRef,
    where('userId', '==', userId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<', Timestamp.fromDate(end)),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

async function waterAmountToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toISOString().split('T')[0];
  const waterDocRef = doc(db, 'water', `${userId}_${dateStr}`);
  const snap = await getDoc(waterDocRef);
  if (!snap.exists()) return 0;
  const data = snap.data();
  return data?.amount || 0;
}

async function loadScheduledIds(key: 'meal' | 'water'): Promise<string[]> {
  const storageKey = key === 'meal' ? STORAGE_KEYS.mealScheduleIds : STORAGE_KEYS.waterScheduleIds;
  const value = await AsyncStorage.getItem(storageKey);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    // ignore
  }
  return [];
}

async function saveScheduledIds(key: 'meal' | 'water', ids: string[]): Promise<void> {
  const storageKey = key === 'meal' ? STORAGE_KEYS.mealScheduleIds : STORAGE_KEYS.waterScheduleIds;
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
}

export async function cancelAllMealReminders(): Promise<void> {
  const ids = await loadScheduledIds('meal');
  await Promise.all(ids.map(id => cancelById(id)));
  await saveScheduledIds('meal', []);
}

export async function cancelAllWaterReminders(): Promise<void> {
  const ids = await loadScheduledIds('water');
  await Promise.all(ids.map(id => cancelById(id)));
  await saveScheduledIds('water', []);
}

export async function scheduleMealReminders(): Promise<void> {
  await cancelAllMealReminders();
  const ids: string[] = [];
  const user = auth.currentUser;
  if (!user) return;

  try {
    const alreadyHasMeals = await hasMealsToday(user.uid);
    if (alreadyHasMeals) {
      await saveScheduledIds('meal', []);
      return;
    }
  } catch (error) {
    console.error('scheduleMealReminders check error', error);
  }

  for (const { hour, minute } of REMINDER_TIMES.meal) {
    const strings = getStrings().meal;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.title,
        body: strings.body,
        sound: Platform.OS === 'android' ? undefined : 'default',
      },
      trigger: buildDateTrigger(hour, minute),
    });
    ids.push(id);
  }
  await saveScheduledIds('meal', ids);
}

export async function scheduleWaterReminders(): Promise<void> {
  await cancelAllWaterReminders();
  const ids: string[] = [];
  const user = auth.currentUser;
  if (!user) return;

  try {
    const amount = await waterAmountToday(user.uid);
    if (amount > 0) {
      await saveScheduledIds('water', []);
      return;
    }
  } catch (error) {
    console.error('scheduleWaterReminders check error', error);
  }
  for (const { hour, minute } of REMINDER_TIMES.water) {
    const strings = getStrings().water;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.title,
        body: strings.body,
        sound: Platform.OS === 'android' ? undefined : 'default',
      },
      trigger: buildDateTrigger(hour, minute),
    });
    ids.push(id);
  }
  await saveScheduledIds('water', ids);
}

export async function saveReminderPreference(key: 'meal' | 'water', enabled: boolean): Promise<void> {
  const storageKey = key === 'meal' ? STORAGE_KEYS.mealReminders : STORAGE_KEYS.waterReminders;
  await AsyncStorage.setItem(storageKey, enabled ? '1' : '0');
}

export async function loadReminderPreference(key: 'meal' | 'water'): Promise<boolean> {
  const storageKey = key === 'meal' ? STORAGE_KEYS.mealReminders : STORAGE_KEYS.waterReminders;
  const value = await AsyncStorage.getItem(storageKey);
  if (value === null) return true; // default ON
  return value === '1';
}

export async function applyReminderPreference(key: 'meal' | 'water', enabled: boolean): Promise<void> {
  await saveReminderPreference(key, enabled);
  if (enabled) {
    if (key === 'meal') await scheduleMealReminders();
    if (key === 'water') await scheduleWaterReminders();
  } else {
    if (key === 'meal') await cancelAllMealReminders();
    if (key === 'water') await cancelAllWaterReminders();
  }
}

export async function notifyBadgeUnlocked(title: string, message?: string): Promise<void> {
  const defaults = getStrings().badge;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || defaults.title,
      body: message || defaults.body,
      sound: Platform.OS === 'android' ? undefined : 'default',
    },
    trigger: null,
  });
}

export async function bootstrapNotifications(): Promise<void> {
  await configureNotificationChannels();
  registerNotificationHandlers();
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const mealPref = await loadReminderPreference('meal');
  const waterPref = await loadReminderPreference('water');

  if (mealPref) await scheduleMealReminders();
  if (waterPref) await scheduleWaterReminders();
}
