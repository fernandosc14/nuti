import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

export function BMIScreen({ navigation }: any) {
  const { theme } = useTheme();

  const bmiCategories = [
    {
      range: 'Below 18.5',
      category: 'Underweight',
      description: 'You may need to gain weight. Consult with a healthcare provider.',
      color: '#3B82F6',
    },
    {
      range: '18.5 - 24.9',
      category: 'Normal weight',
      description: 'Congratulations! You are within a healthy weight range.',
      color: '#3BB273',
    },
    {
      range: '25.0 - 29.9',
      category: 'Overweight',
      description: 'Consider making lifestyle changes to reach a healthier weight.',
      color: '#F59E0B',
    },
    {
      range: '30.0 and above',
      category: 'Obese',
      description: 'It\'s important to work with a healthcare provider to develop a weight management plan.',
      color: '#EF4444',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={[]}>
      {!theme.isDark && (
        <LinearGradient
          colors={['#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {theme.isDark && (
        <LinearGradient
          colors={['#1A2E1F', theme.colors.background || '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
        />
      )}
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: theme.colors.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: theme.colors.text, textAlign: 'center' }}>
          About BMI
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 24,
        }}
      >
        {/* What is BMI */}
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: (theme.colors.primary || '#3BB273') + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="information-circle" size={24} color={theme.colors.primary || '#3BB273'} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
              What is BMI?
            </Text>
          </View>
          <Text style={{ fontSize: 15, lineHeight: 24, color: theme.colors.textSecondary || '#6B7280' }}>
            Body Mass Index (BMI) is a measure of body fat based on height and weight. It's a simple tool used to categorize weight status and assess potential health risks associated with being underweight, normal weight, overweight, or obese.
          </Text>
        </View>

        {/* How it's calculated */}
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: (theme.colors.primary || '#3BB273') + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="calculator" size={24} color={theme.colors.primary || '#3BB273'} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
              How is BMI calculated?
            </Text>
          </View>
          <Text style={{ fontSize: 15, lineHeight: 24, color: theme.colors.textSecondary || '#6B7280', marginBottom: 12 }}>
            BMI is calculated using the following formula:
          </Text>
          <View
            style={{
              backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 8 }}>
              BMI = weight (kg) ÷ height (m)²
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary || '#6B7280', textAlign: 'center' }}>
              Or: BMI = (weight (lbs) ÷ height (in)²) × 703
            </Text>
          </View>
          <Text style={{ fontSize: 15, lineHeight: 24, color: theme.colors.textSecondary || '#6B7280' }}>
            For example, if you weigh 70 kg and are 1.75 m tall, your BMI would be 70 ÷ (1.75)² = 22.9.
          </Text>
        </View>

        {/* BMI Categories */}
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: (theme.colors.primary || '#3BB273') + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="list" size={24} color={theme.colors.primary || '#3BB273'} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
              BMI Categories
            </Text>
          </View>
          <View style={{ gap: 16 }}>
            {bmiCategories.map((category, index) => (
              <View
                key={index}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: category.color + '40',
                  backgroundColor: category.color + '10',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: category.color,
                      marginRight: 10,
                    }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1 }}>
                    {category.category}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: category.color }}>
                    {category.range}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary || '#6B7280', marginLeft: 22 }}>
                  {category.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Important Notes */}
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F59E0B20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="warning" size={24} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
              Important Notes
            </Text>
          </View>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 16, color: '#F59E0B', marginRight: 8 }}>•</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary || '#6B7280', flex: 1 }}>
                BMI is a screening tool, not a diagnostic tool. It doesn't directly measure body fat or account for muscle mass.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 16, color: '#F59E0B', marginRight: 8 }}>•</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary || '#6B7280', flex: 1 }}>
                Athletes and individuals with high muscle mass may have a higher BMI but not be overweight.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 16, color: '#F59E0B', marginRight: 8 }}>•</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary || '#6B7280', flex: 1 }}>
                BMI may not be accurate for children, elderly individuals, or pregnant women.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 16, color: '#F59E0B', marginRight: 8 }}>•</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary || '#6B7280', flex: 1 }}>
                Always consult with a healthcare provider for personalized health advice.
              </Text>
            </View>
          </View>
        </View>

        {/* Source */}
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: (theme.colors.primary || '#3BB273') + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="library" size={24} color={theme.colors.primary || '#3BB273'} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
              Source
            </Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary || '#6B7280' }}>
            BMI categories and ranges are based on guidelines from the World Health Organization (WHO) and the Centers for Disease Control and Prevention (CDC).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

