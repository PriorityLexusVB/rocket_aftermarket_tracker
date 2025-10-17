import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, FileText, Lock, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md text-center">
        {/* Friendly Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-100 p-6">
            <Home className="h-16 w-16 text-blue-600" />
          </div>
        </div>

        {/* Friendly Message - No 404 mention */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Let's get you back on track</h1>
        <p className="text-gray-600 mb-8">
          {user ? 
            "It looks like you're trying to access a page that isn't available. Let's get you to where you need to go." : "Welcome! Please sign in to access your account and manage your business operations."
          }
        </p>

        {/* Navigation Options */}
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
                to="/currently-active-appointments"
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                View Active Appointments
              </Link>
              <button
                onClick={() => window.history?.back()}
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Go Back
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Lock className="h-5 w-5 mr-2" />
                Sign In to Your Account
              </Link>
              <Link
                to="/guest-claims-submission-form"
                className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FileText className="h-5 w-5 mr-2" />
                Submit a Claim
              </Link>
            </>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-center text-blue-700 mb-2">
            <Lock className="h-4 w-4 mr-2" />
            <span className="font-semibold">Need Help?</span>
          </div>
          <p className="text-sm text-blue-600">
            {user ? 
              'Contact your system administrator if you need access to specific features or pages.' :
              'Sign in to access internal systems and manage your business operations securely.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;