import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

// Import Pages
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Dashboard from '../pages/Dashboard';
import Profile from '../pages/Profile';
import Trips from '../pages/Trips';
import CreateTrip from '../pages/CreateTrip';
import TripDetails from '../pages/TripDetails';
import AIPlanner from '../pages/AIPlanner';
import TravelBuddies from '../pages/TravelBuddies';
import Discovery from '../pages/Discovery';
import TravelerProfile from '../pages/TravelerProfile';
import Requests from '../pages/Requests';
import Connections from '../pages/Connections';
import Chat from '../pages/Chat';
import CollabWorkspace from '../pages/CollabWorkspace';
import AdminDashboard from '../pages/AdminDashboard';
import WeatherForecastPage from '../pages/WeatherForecastPage';
import AITripPlannerPage from '../pages/AITripPlannerPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <Trips />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/create"
        element={
          <ProtectedRoute>
            <CreateTrip />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:tripId"
        element={
          <ProtectedRoute>
            <TripDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:tripId/ai-planner"
        element={
          <ProtectedRoute>
            <AIPlanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <Discovery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/travel-buddies"
        element={
          <ProtectedRoute>
            <TravelBuddies />
          </ProtectedRoute>
        }
      />
      <Route
        path="/weather"
        element={
          <ProtectedRoute>
            <WeatherForecastPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-planner"
        element={
          <ProtectedRoute>
            <AITripPlannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/travelers/:userId"
        element={
          <ProtectedRoute>
            <TravelerProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <Requests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/connections"
        element={
          <ProtectedRoute>
            <Connections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:connectionId"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/trips/:tripId/collaboration"
        element={
          <ProtectedRoute>
            <CollabWorkspace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback Catch-all Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
