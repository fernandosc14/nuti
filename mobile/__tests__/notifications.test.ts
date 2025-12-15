/**
 * Testes para serviços de notificações locais
 */

jest.mock('expo-notifications', () => {
  const scheduleNotificationAsync = jest.fn();
  const cancelScheduledNotificationAsync = jest.fn();
  const setNotificationChannelAsync = jest.fn();
  const setNotificationHandler = jest.fn();
  const getPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  const requestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));

  return {
    scheduleNotificationAsync,
    cancelScheduledNotificationAsync,
    setNotificationChannelAsync,
    setNotificationHandler,
    getPermissionsAsync,
    requestPermissionsAsync,
    SchedulableTriggerInputTypes: {
      CALENDAR: 'calendar',
    },
    AndroidImportance: {
      DEFAULT: 'default',
    },
  };
});

jest.mock('../services/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}));

jest.mock('firebase/firestore', () => {
  const getDocs = jest.fn(() => Promise.resolve({ empty: true }));
  const getDoc = jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({ amount: 0 }) } as any));
  return {
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((d) => d),
    },
    getDocs,
    getDoc,
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
}));

import {
  applyReminderPreference,
  bootstrapNotifications,
} from '../services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const notificationsMock = Notifications as jest.Mocked<typeof Notifications>;
const storageMock = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('notifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Garantir que permissões estão concedidas por padrão
    notificationsMock.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    notificationsMock.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    storageMock.getItem.mockResolvedValue(null);
  });

  test('ativa lembretes de refeição agenda notificações e persiste preferência', async () => {
    // scheduleNotificationAsync deve devolver ids
    notificationsMock.scheduleNotificationAsync.mockResolvedValueOnce('m1');

    await applyReminderPreference('meal', true);

    expect(storageMock.setItem).toHaveBeenCalledWith('prefs_meal_reminders_enabled', '1');
    // Cancela agendamentos antigos (nenhum) e cria um novo (14h)
    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(0);
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // Armazena ids dos agendamentos criados
    expect(storageMock.setItem).toHaveBeenCalledWith('prefs_meal_reminder_ids', JSON.stringify(['m1']));
  });

  test('desativa lembretes de refeição cancela notificações', async () => {
    // Simular ids previamente guardados
    storageMock.getItem.mockResolvedValueOnce(JSON.stringify(['x1', 'x2']));

    await applyReminderPreference('meal', false);

    expect(storageMock.setItem).toHaveBeenCalledWith('prefs_meal_reminders_enabled', '0');
    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(storageMock.setItem).toHaveBeenCalledWith('prefs_meal_reminder_ids', JSON.stringify([]));
  });

  test('bootstrapNotifications reconfigura canais e reprograma agendamentos quando permissões e prefs estão ativos', async () => {
    // meal e water ativados; primeiro dois gets são prefs, depois ids (vazios)
    storageMock.getItem
      .mockResolvedValueOnce('1') // meal enabled
      .mockResolvedValueOnce('1') // water enabled
      .mockResolvedValueOnce(null) // meal ids
      .mockResolvedValueOnce(null); // water ids

    notificationsMock.scheduleNotificationAsync
      .mockResolvedValueOnce('m1')
      .mockResolvedValueOnce('w1');

    await bootstrapNotifications();

    // Canal criado para Android
    expect(notificationsMock.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.any(Object));
    // Cancela antigos (nenhum) e agenda novos: 1 refeição (14h) + 1 água (17h)
    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(0);
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });
});
