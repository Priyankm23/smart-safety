import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "../features/auth/screens/LoginScreen";
import LoginWithCodesScreen from "../features/auth/screens/LoginWithCodesScreen";
import RegisterScreen from "../features/auth/screens/RegisterScreen";
import BasicInfoScreen from "../features/auth/screens/BasicInfoScreen";
import AdditionalInfoScreen from "../features/auth/screens/AdditionalInfoScreen";
import AddGroupMemberScreen from "../features/auth/screens/AddGroupMemberScreen";
import DashboardScreen from "../features/dashboard/screens/DashboardScreen";
import ItineraryScreen from "../features/trip/screens/ItineraryScreen";
import EmergencyScreen from "../features/emergency/screens/EmergencyScreen";
import SettingsScreen from "../features/settings/screens/SettingsScreen";
import HelpCenterScreen from "../features/settings/screens/HelpCenterScreen";
import ReportIssueScreen from "../features/report/screens/ReportIssueScreen";
import PersonalInfoScreen from "../features/user/screens/PersonalInfoScreen";
import AppSettingsScreen from "../features/settings/screens/AppSettingsScreen";
import AuthorityDashboardScreen from "../features/dashboard/screens/AuthorityDashboardScreen";
import { useApp } from "../context/AppContext";
import { usePathDeviation } from "../context/PathDeviationContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import DashboardLogo from "../components/Icons/DashboardLogo";
import { View, Text, StyleSheet } from "react-native";
import EmergencyMapLogo from "../components/Icons/EmergencyMapLogo";
import SettingsIcon from "../components/Icons/SettingsIcon";
import ItineraryIcon from "../components/Icons/ItineraryIcon";
import OnboardingScreen from "../features/onboarding/screens/OnboardingScreen";

import CreateTripScreen from "../features/trip/screens/CreateTripScreen";
import JoinGroupScreen from "../features/trip/screens/JoinGroupScreen";
import TripDurationScreen from "../features/trip/screens/TripDurationScreen";
import BuildItineraryScreen from "../features/trip/screens/BuildItineraryScreen";
import PeopleScreen from "../features/people/screens/PeopleScreen";
import EditPersonScreen from "../features/people/screens/EditPersonScreen";
import AddPersonScreen from "../features/people/screens/AddPersonScreen";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  CreateTrip: undefined;
  JoinGroup: undefined;
  TripDuration: { touristId: string };
  BuildItinerary: { 
    tripDuration: number;
    startDate: string;
    returnDate: string;
    touristId: string;
  };
  Authority: undefined;
  HelpCenter: undefined;
  ReportIssue: undefined;
  PersonalInfo: undefined;
  AppSettings: undefined;
  GeoFenceDebug: undefined;
  EditPerson: { person: any };
  AddPerson: undefined;
  AddGroupMember: undefined;
  // Transitions: undefined
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabBarBackground() {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 32,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(0, 0, 0, 0.04)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
      }}
    />
  );
}

function MainTabs() {
  const theme = useTheme();
  const { state } = useApp();
  const { isTracking } = usePathDeviation();
  const isTourAdmin = state.user?.role === 'tour-admin';
  const activeColor = "#3b82f6";
  const inactiveColor = "#9ca3af";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: isTracking ? { display: 'none' } : {
          position: "absolute",
          bottom: 25,
          left: 24,
          right: 24,
          elevation: 0,
          backgroundColor: "transparent",
          borderRadius: 32,
          overflow: "hidden",
          height: 70,
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingHorizontal: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 0,
          margin: 0,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: 60,
              }}
            >
              <DashboardLogo
                color={focused ? activeColor : inactiveColor}
                size={26}
                filled={focused}
              />
              {focused && (
                <>
                  <Text
                    style={{
                      color: activeColor,
                      fontSize: 10,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Dashboard
                  </Text>
                </>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={EmergencyScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: 60,
              }}
            >
              <EmergencyMapLogo
                color={focused ? activeColor : inactiveColor}
                size={26}
                filled={focused}
              />
              {focused && (
                <>
                  <Text
                    style={{
                      color: activeColor,
                      fontSize: 10,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Map
                  </Text>
                </>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Itinerary"
        component={ItineraryScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: 60,
              }}
            >
              <ItineraryIcon
                color={focused ? activeColor : inactiveColor}
                size={26}
                filled={focused}
              />
              {focused && (
                <>
                  <Text
                    style={{
                      color: activeColor,
                      fontSize: 10,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Itinerary
                  </Text>
                </>
              )}
            </View>
          ),
        }}
      />
      {isTourAdmin && (
        <Tab.Screen
          name="People"
          component={PeopleScreen}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  height: 60,
                }}
              >
                <MaterialCommunityIcons
                  name="account-group"
                  size={26}
                  color={focused ? activeColor : inactiveColor}
                />
                {focused && (
                  <>
                    <Text
                      style={{
                        color: activeColor,
                        fontSize: 10,
                        marginTop: 2,
                        fontWeight: "600",
                      }}
                    >
                      People
                    </Text>
                  </>
                )}
              </View>
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: 60,
              }}
            >
              <SettingsIcon
                color={focused ? activeColor : inactiveColor}
                size={26}
                filled={focused}
              />
              {focused && (
                <>
                  <Text
                    style={{
                      color: activeColor,
                      fontSize: 10,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Map
                  </Text>
                </>
              )}
            </View>
          ),
        }}
      />
      {/* <Tab.Screen
        name="Transitions"
        component={TransitionsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" color={color} size={size} />,
        }}
      /> */}
    </Tab.Navigator>
  );
}

function AuthStack() {
  const StackAuth = createNativeStackNavigator();
  return (
    <StackAuth.Navigator>
      <StackAuth.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <StackAuth.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <StackAuth.Screen
        name="LoginWithCodes"
        component={LoginWithCodesScreen}
        options={{ headerShown: false }}
      />
      <StackAuth.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <StackAuth.Screen
        name="BasicInfo"
        component={BasicInfoScreen}
        options={{ headerShown: false }}
      />
      <StackAuth.Screen
        name="AdditionalInfo"
        component={AdditionalInfoScreen}
        options={{ headerShown: false }}
      />
    </StackAuth.Navigator>
  );
}

export function RootNavigator() {
  const { state } = useApp();
  const user = state.user as any;
  
  const isTourAdmin = user?.role === "tour-admin";
  const isGroupMember = user?.role === "group-member";
  
  // Strict checks for specific roles
  // Admins must have an ownedGroupId. If they have a groupId but no ownedGroupId, they still need to create a trip.
  const adminHasGroup = !!user?.ownedGroupId;
  // Members must have a groupId.
  const memberHasGroup = !!user?.groupId && user?.groupId !== "joined"; // "joined" is a temp state in some contexts, but let's stick to truthy

  // Determine initial route based on authentication and onboarding state
  let initialRoute: keyof RootStackParamList;
  const isSolo = user?.role === "solo";
  const soloHasItinerary = isSolo && user?.dayWiseItinerary && user?.dayWiseItinerary.length > 0;

  if (!state.user) {
    // Unauthenticated users should always start at the Auth stack
    initialRoute = "Auth";
  } else {
    // Authenticated users default to Main, with onboarding flows for just-registered users
    initialRoute = "Main";
    if (state.justRegistered) {
      if (isGroupMember && !memberHasGroup) {
        initialRoute = "JoinGroup";
      } else if (isTourAdmin && !adminHasGroup) {
        initialRoute = "TripDuration";
      } else if (isSolo && !soloHasItinerary) {
        initialRoute = "TripDuration";
      }
    }
  }

  return (
    // Unique key forces remount on login/logout so initialRouteName is re-evaluated
    <Stack.Navigator key={state.user ? "authenticated" : "guest"} initialRouteName={initialRoute}>
      {!state.user ? (
        <Stack.Screen
          name="Auth"
          component={AuthStack}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateTrip"
            component={CreateTripScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="JoinGroup"
            component={JoinGroupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TripDuration"
            component={TripDurationScreen}
            options={{ 
              title: "Plan Your Trip",
              headerShown: true,
              headerBackVisible: false 
            }}
          />
          <Stack.Screen
            name="BuildItinerary"
            component={BuildItineraryScreen}
            options={{ 
              title: "Build Itinerary",
              headerShown: true 
            }}
          />
          <Stack.Screen
            name="Authority"
            component={AuthorityDashboardScreen}
            options={{ title: "Authority Dashboard (Mock)" }}
          />
          <Stack.Screen
            name="HelpCenter"
            component={HelpCenterScreen}
            options={{ title: "Help Center", headerShown: true }}
          />
          <Stack.Screen
            name="ReportIssue"
            component={ReportIssueScreen}
            options={{ title: "Report an Issue", headerShown: true }}
          />
          <Stack.Screen
            name="PersonalInfo"
            component={PersonalInfoScreen}
            options={{ title: "Personal Information", headerShown: true }}
          />
          <Stack.Screen
            name="AppSettings"
            component={AppSettingsScreen}
            options={{ title: "App Settings", headerShown: true }}
          />
          <Stack.Screen
            name="EditPerson"
            component={EditPersonScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddPerson"
            component={AddPersonScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddGroupMember"
            component={AddGroupMemberScreen}
            options={{ headerShown: false }}
          />
          {/* <Stack.Screen
            name="GeoFenceDebug"
            component={GeoFenceDebugScreen}
            options={{ title: 'GeoFence Debug' }}
          /> */}
          {/* <Stack.Screen
            name="Transitions"
            component={TransitionsScreen}
            options={{ title: 'Transition History' }}
          /> */}
        </>
      )}
    </Stack.Navigator>
  );
}
