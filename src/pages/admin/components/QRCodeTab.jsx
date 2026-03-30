import React from 'react'
import QRCodeGenerator from '../../../components/common/QRCodeGenerator'

const QRCodeTab = () => {
  const guestClaimsUrl = `${window?.location?.origin}/guest-claims-submission-form`

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">QR Code Generator</h3>
        <p className="text-gray-600">
          Generate QR codes for easy access to your guest claims form and other important links.
        </p>
      </div>

      {/* Guest Claims Form QR Code */}
      <div>
        <QRCodeGenerator
          url={guestClaimsUrl}
          title="Guest Claims Submission Form"
          description="Generate a QR code for customers to quickly access your guest claims form. Perfect for printing on business cards, flyers, or displaying in your shop."
          size={250}
          showControls={true}
        />
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3">How to Use QR Codes:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
          <div>
            <h5 className="font-medium mb-2">📱 For Customers:</h5>
            <ul className="space-y-1">
              <li>• Open camera app on smartphone</li>
              <li>• Point camera at QR code</li>
              <li>• Tap notification to open claims form</li>
              <li>• No app download required</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium mb-2">🖨️ For Your Business:</h5>
            <ul className="space-y-1">
              <li>• Download and print QR codes</li>
              <li>• Add to business cards</li>
              <li>• Display in waiting areas</li>
              <li>• Include in email signatures</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-3">QR Code Benefits:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-green-600">95%</div>
            <div className="text-gray-600">Smartphone QR Support</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-blue-600">3x</div>
            <div className="text-gray-600">Faster Than Typing URLs</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-purple-600">100%</div>
            <div className="text-gray-600">Contactless Access</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRCodeTab
