import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import ApplicationScreen from './src/screens/ApplicationScreen';
import CalculationScreen from './src/screens/CalculationScreen';
import VerificationScreen from './src/screens/VerificationScreen';
import ISOScreen from './src/screens/ISOScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Aplicação',   component: ApplicationScreen,  icon: 'construct',    label: 'Aplicação'   },
  { name: 'Cálculo',     component: CalculationScreen,  icon: 'calculator',   label: 'Cálculo'     },
  { name: 'Verificação', component: VerificationScreen, icon: 'checkmark-circle', label: 'Verificação' },
  { name: 'ISO',         component: ISOScreen,          icon: 'document-text',label: 'ISO'         },
  { name: 'Histórico',   component: HistoryScreen,      icon: 'time',         label: 'Histórico'   },
];

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1565C0" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const tab = TAB_CONFIG.find(t => t.name === route.name);
            return <Ionicons name={tab?.icon || 'apps'} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#1565C0',
          tabBarInactiveTintColor: '#90A4AE',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#ECEFF1',
            height: 60,
            paddingBottom: 6,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          headerStyle: { backgroundColor: '#1565C0' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        })}
      >
        {TAB_CONFIG.map(tab => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={{ title: tab.label }}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
