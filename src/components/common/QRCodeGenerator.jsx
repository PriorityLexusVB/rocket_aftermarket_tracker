import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Share, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';

const QRCodeGenerator = ({ 
  url, 
  title = "QR Code", 
  description = "Scan this QR code to access the form",
  size = 200,
  showControls = true 
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [customSize, setCustomSize] = useState(size);
  const [customUrl, setCustomUrl] = useState(url || '');
  const canvasRef = useRef(null);

  // Generate QR code whenever URL or size changes
  useEffect(() => {
    if (customUrl?.trim()) {
      generateQRCode(customUrl, customSize);
    }
  }, [customUrl, customSize]);

  const generateQRCode = async (targetUrl, qrSize = 200) => {
    try {
      setLoading(true);
      setError(null);

      if (!targetUrl?.trim()) {
        throw new Error('URL is required to generate QR code');
      }

      // Validate URL format
      let finalUrl = targetUrl?.trim();
      if (!finalUrl?.startsWith('http://') && !finalUrl?.startsWith('https://')) {
        // If it's a relative path, make it absolute
        if (finalUrl?.startsWith('/')) {
          finalUrl = `${window?.location?.origin}${finalUrl}`;
        } else {
          finalUrl = `https://${finalUrl}`;
        }
      }

      // Generate QR code as data URL
      const qrDataUrl = await QRCode?.toDataURL(finalUrl, {
        width: qrSize,
        height: qrSize,
        margin: 2,
        color: {
          dark: '#000000',  // Dark color
          light: '#FFFFFF', // Light color
        },
        errorCorrectionLevel: 'M'
      });

      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError(error?.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    try {
      const link = document?.createElement('a');
      link.download = `${title?.replace(/[^a-zA-Z0-9]/g, '_')}_QRCode.png`;
      link.href = qrCodeDataUrl;
      document?.body?.appendChild(link);
      link?.click();
      document?.body?.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      setError('Failed to download QR code');
    }
  };

  const copyToClipboard = async () => {
    try {
      if (navigator?.clipboard && qrCodeDataUrl) {
        // Try to copy the image
        const response = await fetch(qrCodeDataUrl);
        const blob = await response?.blob();
        await navigator?.clipboard?.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback: copy the URL
        await navigator?.clipboard?.writeText(customUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback: copy URL as text
      try {
        await navigator?.clipboard?.writeText(customUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        setError('Failed to copy to clipboard');
      }
    }
  };

  const shareQRCode = async () => {
    try {
      if (navigator?.share && qrCodeDataUrl) {
        // Convert data URL to blob for sharing
        const response = await fetch(qrCodeDataUrl);
        const blob = await response?.blob();
        const file = new File([blob], `${title}_QRCode.png`, { type: 'image/png' });

        await navigator?.share({
          title: title,
          text: description,
          url: customUrl,
          files: [file]
        });
      } else {
        // Fallback: copy URL to clipboard
        await copyToClipboard();
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      if (error?.name !== 'AbortError') {
        setError('Failed to share QR code');
      }
    }
  };

  const resetToDefault = () => {
    setCustomUrl(url || '');
    setCustomSize(size);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center mb-4">
        <QrCode className="w-5 h-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {description && (
        <p className="text-gray-600 text-sm mb-6">{description}</p>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Controls (if enabled) */}
      {showControls && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL to Generate QR Code
            </label>
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e?.target?.value)}
              placeholder="Enter URL (e.g., https://yoursite.com/guest-claims-form)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              QR Code Size: {customSize}px
            </label>
            <input
              type="range"
              min="100"
              max="400"
              step="25"
              value={customSize}
              onChange={(e) => setCustomSize(parseInt(e?.target?.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => generateQRCode(customUrl, customSize)}
              disabled={loading || !customUrl?.trim()}
              variant="primary"
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </Button>
            
            <Button
              onClick={resetToDefault}
              variant="secondary"
              className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* QR Code Display */}
      <div className="flex flex-col items-center mb-6">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Generating QR Code...</span>
          </div>
        )}

        {qrCodeDataUrl && !loading && (
          <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
            <img 
              src={qrCodeDataUrl} 
              alt={`QR Code for ${title}`}
              className="block"
              style={{ width: customSize, height: customSize }}
            />
          </div>
        )}

        {!qrCodeDataUrl && !loading && customUrl?.trim() && (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Click &quot;Generate QR Code&quot; to create QR code</p>
            </div>
          </div>
        )}

        {!customUrl?.trim() && showControls && (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Enter a URL to generate QR code</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {qrCodeDataUrl && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            onClick={downloadQRCode}
            variant="primary"
            className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </Button>

          <Button
            onClick={copyToClipboard}
            variant="secondary"
            className={`flex items-center gap-2 ${
              copied 
                ? 'bg-green-100 text-green-800 border-green-300' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>

          {navigator?.share && (
            <Button
              onClick={shareQRCode}
              variant="secondary"
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-2"
            >
              <Share className="w-4 h-4" />
              Share
            </Button>
          )}
        </div>
      )}

      {/* URL Display */}
      {customUrl && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-500 mb-1">Target URL:</p>
          <p className="text-sm font-mono text-gray-800 break-all">{customUrl}</p>
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;