import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Home, FileText, Lock } from 'lucide-react';

const NotFound = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldAlert className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          {user ? 
            "Sorry, the page you're looking for doesn't exist or you don't have permission to access it." :
            "This page requires authentication. Please sign in to continue."
          }
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          {user ? (
            <>
              <Link
                to="/deals"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Home className="h-5 w-5 mr-2" />
                Go to Dashboard
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Admin Panel
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Lock className="h-5 w-5 mr-2" />
                Sign In
              </Link>
              <Link
                to="/guest-claims-submission-form"
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FileText className="h-5 w-5 mr-2" />
                Submit Guest Claim
              </Link>
            </>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-center text-blue-700 mb-2">
            <Lock className="h-4 w-4 mr-2" />
            <span className="font-semibold">Security Notice</span>
          </div>
          <p className="text-sm text-blue-600">
            Most pages on this site require authentication to protect sensitive business data. 
            {!user && ' Please sign in to access internal systems.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;