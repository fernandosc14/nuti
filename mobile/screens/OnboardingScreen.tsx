/**
 * OnboardingScreen
 * 
 * Fluxo de onboarding para novos utilizadores
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

type OnboardingStep = 
  | 'welcome'
  | 'gender'
  | 'workouts'
  | 'heardFrom'
  | 'triedOtherApps'
  | 'heightWeight'
  | 'dateOfBirth'
  | 'goal'
  | 'desiredWeight'
  | 'realisticTarget';

const TOTAL_STEPS = 10;

export function OnboardingScreen({ navigation }: any) {
  const { user, profile, updateProfile } = useUser();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState(false);

  // Form data
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<'0-2' | '3-6' | '6+' | null>(null);
  const [heardFrom, setHeardFrom] = useState<string | null>(null);
  const [triedOtherApps, setTriedOtherApps] = useState<boolean | null>(null);
  const [isImperial, setIsImperial] = useState(false);
  const [heightFeet, setHeightFeet] = useState('5');
  const [heightInches, setHeightInches] = useState('9');
  const [heightCm, setHeightCm] = useState('175');
  const [weightLbs, setWeightLbs] = useState('155');
  const [weightKg, setWeightKg] = useState('70');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | null>(null);
  const [desiredWeight, setDesiredWeight] = useState('');

  const stepIndex = {
    welcome: 0,
    gender: 1,
    workouts: 2,
    heardFrom: 3,
    triedOtherApps: 4,
    heightWeight: 5,
    dateOfBirth: 6,
    goal: 7,
    desiredWeight: 8,
    realisticTarget: 9,
  };

  const currentStepIndex = stepIndex[currentStep];
  const progress = (currentStepIndex / (TOTAL_STEPS - 1)) * 100;

  const handleNext = () => {
    const steps: OnboardingStep[] = [
      'welcome',
      'gender',
      'workouts',
      'heardFrom',
      'triedOtherApps',
      'heightWeight',
      'dateOfBirth',
      'goal',
      'desiredWeight',
      'realisticTarget',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = [
      'welcome',
      'gender',
      'workouts',
      'heardFrom',
      'triedOtherApps',
      'heightWeight',
      'dateOfBirth',
      'goal',
      'desiredWeight',
      'realisticTarget',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'gender':
        return gender !== null;
      case 'workouts':
        return workoutsPerWeek !== null;
      case 'heardFrom':
        return heardFrom !== null;
      case 'triedOtherApps':
        return triedOtherApps !== null;
      case 'heightWeight':
        if (isImperial) {
          return heightFeet && heightInches && weightLbs;
        }
        return heightCm && weightKg;
      case 'dateOfBirth':
        return true;
      case 'goal':
        return goal !== null;
      case 'desiredWeight':
        return desiredWeight !== '';
      default:
        return true;
    }
  };

  const handleFinish = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Converter altura e peso para métricas (sempre guardar em cm e kg)
      let height: number; // em cm
      let weight: number; // em kg
      let desiredWeightNum: number; // em kg

      if (isImperial) {
        // Converter de Imperial para Metric
        const feet = parseInt(heightFeet) || 5;
        const inches = parseInt(heightInches) || 9;
        height = feet * 30.48 + inches * 2.54; // cm
        
        weight = parseFloat(weightLbs) * 0.453592; // kg
        desiredWeightNum = parseFloat(desiredWeight) * 0.453592; // kg
      } else {
        // Já está em Metric
        height = parseFloat(heightCm) || 175; // cm
        weight = parseFloat(weightKg) || 70; // kg
        desiredWeightNum = parseFloat(desiredWeight) || 75; // kg
      }

      // Guardar dados do onboarding
      const onboardingData = {
        gender,
        workoutsPerWeek,
        heardFrom,
        triedOtherApps,
        height,
        weight,
        dateOfBirth: Timestamp.fromDate(dateOfBirth),
        goal,
        desiredWeight: desiredWeightNum,
        onboardingCompleted: true,
      };

      await updateProfile(onboardingData);

      Toast.show({
        type: 'success',
        text1: 'Perfil criado!',
        text2: 'Bem-vindo ao Nuti!',
      });

      navigation.replace('Dashboard');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao guardar dados',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    if (currentStep === 'welcome') return null;
    
    return (
      <View className="px-6 pt-4 pb-2">
        <View className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
          <View
            className="h-1 bg-green-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              Calorie tracking made easy
            </Text>
            <View className="w-64 h-96 bg-gray-100 dark:bg-gray-800 rounded-3xl mb-8 items-center justify-center">
              <Text className="text-6xl">📱</Text>
            </View>
            <TouchableOpacity
              onPress={handleNext}
              className="bg-green-500 rounded-xl py-4 px-12 w-full items-center"
            >
              <Text className="text-white font-semibold text-lg">Get Started</Text>
            </TouchableOpacity>
          </View>
        );

      case 'gender':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Choose your Gender
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              This will be used to calibrate your custom plan.
            </Text>
            <View className="space-y-4">
              {(['male', 'female', 'other'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  className={`rounded-xl py-4 px-6 border-2 ${
                    gender === g
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      gender === g ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Other'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'workouts':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              How many workouts do you do per week?
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              This will be used to calibrate your custom plan.
            </Text>
            <View className="space-y-4">
              {([
                { value: '0-2', label: '0-2 Workouts/runs and Gym' },
                { value: '3-6', label: '3-6 New workouts per week' },
                { value: '6+', label: '6+ Dedicated athlete' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setWorkoutsPerWeek(option.value)}
                  className={`rounded-xl py-4 px-6 border-2 ${
                    workoutsPerWeek === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      workoutsPerWeek === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'heardFrom':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Where did you hear about us?
            </Text>
            <ScrollView>
              <View className="space-y-3">
                {['Instagram', 'Facebook', 'TikTok', 'Youtube', 'Google', 'TV'].map((source) => (
                  <TouchableOpacity
                    key={source}
                    onPress={() => setHeardFrom(source)}
                    className={`rounded-xl py-4 px-6 border-2 flex-row items-center ${
                      heardFrom === source
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <Ionicons
                      name="logo-instagram"
                      size={24}
                      color={heardFrom === source ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      className={`text-lg font-semibold ml-4 ${
                        heardFrom === source
                          ? 'text-white'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {source}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 'triedOtherApps':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Have you tried other calorie tracking apps?
            </Text>
            <View className="space-y-4">
              {[
                { value: false, label: 'No' },
                { value: true, label: 'Yes' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => setTriedOtherApps(option.value)}
                  className={`rounded-xl py-4 px-6 border-2 ${
                    triedOtherApps === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      triedOtherApps === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'heightWeight':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Height & weight
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-6">
              This will be used to calibrate your custom plan.
            </Text>

            {/* Unit Toggle */}
            <View className="flex-row mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <TouchableOpacity
                onPress={() => setIsImperial(false)}
                className={`flex-1 py-2 rounded-lg ${
                  !isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Metric
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsImperial(true)}
                className={`flex-1 py-2 rounded-lg ${
                  isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Imperial
                </Text>
              </TouchableOpacity>
            </View>

            {isImperial ? (
              <>
                <View className="mb-4">
                  <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                    Height
                  </Text>
                  <View className="flex-row space-x-2">
                    <TextInput
                      className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                      placeholder="5"
                      value={heightFeet}
                      onChangeText={setHeightFeet}
                      keyboardType="numeric"
                    />
                    <Text className="self-center text-gray-600 dark:text-gray-400">ft</Text>
                    <TextInput
                      className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                      placeholder="9"
                      value={heightInches}
                      onChangeText={setHeightInches}
                      keyboardType="numeric"
                    />
                    <Text className="self-center text-gray-600 dark:text-gray-400">in</Text>
                  </View>
                </View>
                <View>
                  <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                    Weight
                  </Text>
                  <TextInput
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                    placeholder="155"
                    value={weightLbs}
                    onChangeText={setWeightLbs}
                    keyboardType="numeric"
                  />
                  <Text className="mt-2 text-gray-600 dark:text-gray-400">lbs</Text>
                </View>
              </>
            ) : (
              <>
                <View className="mb-4">
                  <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                    Height
                  </Text>
                  <TextInput
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                    placeholder="175"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="numeric"
                  />
                  <Text className="mt-2 text-gray-600 dark:text-gray-400">cm</Text>
                </View>
                <View>
                  <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                    Weight
                  </Text>
                  <TextInput
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                    placeholder="70"
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                  />
                  <Text className="mt-2 text-gray-600 dark:text-gray-400">kg</Text>
                </View>
              </>
            )}
          </View>
        );

      case 'dateOfBirth':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              When were you born?
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              This will be used to calibrate your custom plan.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 border border-gray-200 dark:border-gray-700"
            >
              <Text className="text-gray-900 dark:text-white text-lg">
                {dateOfBirth.toLocaleDateString('pt-PT', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setDateOfBirth(selectedDate);
                  }
                }}
                maximumDate={new Date()}
              />
            )}
          </View>
        );

      case 'goal':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              What is your goal?
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              This helps us generate a plan for your calorie intake.
            </Text>
            <View className="space-y-4">
              {([
                { value: 'lose', label: 'Lose weight' },
                { value: 'maintain', label: 'Maintain' },
                { value: 'gain', label: 'Gain weight' },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setGoal(option.value)}
                  className={`rounded-xl py-4 px-6 border-2 ${
                    goal === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      goal === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'desiredWeight':
        const currentWeightDisplay = isImperial 
          ? (parseFloat(weightLbs) || 155).toFixed(1)
          : (parseFloat(weightKg) || 70).toFixed(1);
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              What is your desired weight?
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-6">
              Current weight: {currentWeightDisplay} {isImperial ? 'lbs' : 'kg'}
            </Text>
            <TextInput
              className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 text-2xl text-center"
              placeholder={isImperial ? "165.0" : "75.0"}
              value={desiredWeight}
              onChangeText={setDesiredWeight}
              keyboardType="numeric"
            />
            <Text className="mt-2 text-center text-gray-600 dark:text-gray-400">
              {isImperial ? 'lbs' : 'kg'}
            </Text>
          </View>
        );

      case 'realisticTarget':
        const currentWeightLbs = isImperial 
          ? parseFloat(weightLbs) || 155 
          : (parseFloat(weightKg) || 70) * 2.20462;
        const targetWeightLbs = isImperial 
          ? parseFloat(desiredWeight) || 165 
          : (parseFloat(desiredWeight) || 75) * 2.20462;
        const weightDiffLbs = Math.abs(targetWeightLbs - currentWeightLbs);
        const weightDiffKg = weightDiffLbs * 0.453592;
        const goalText = goal === 'lose' ? 'Perder' : goal === 'gain' ? 'Ganhar' : 'Manter';
        const weightDiff = isImperial ? weightDiffLbs : weightDiffKg;
        const unit = isImperial ? 'lbs' : 'kg';

        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              {goalText} {weightDiff.toFixed(1)} {unit} é um objetivo realista. Não é difícil!
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center text-lg mb-8">
              90% dos utilizadores dizem que a mudança é óbvia após usar o Nuti e não é fácil voltar atrás.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {renderProgressBar()}
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-between px-6 py-8">
          {renderStep()}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <View className="flex-row space-x-4">
          {currentStep !== 'welcome' && (
            <TouchableOpacity
              onPress={handleBack}
              className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
            >
              <Text className="text-gray-900 dark:text-white font-semibold">Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={currentStep === 'realisticTarget' ? handleFinish : handleNext}
            disabled={!canProceed() || loading}
            className={`flex-1 rounded-xl py-4 items-center ${
              canProceed() && !loading
                ? 'bg-green-500'
                : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            {loading ? (
              <Text className="text-white font-semibold">Loading...</Text>
            ) : (
              <Text className="text-white font-semibold">
                {currentStep === 'realisticTarget' ? 'Finish' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

