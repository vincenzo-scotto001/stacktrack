import React, { useState, useEffect } from 'react';

function PWAInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running on iOS device
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // For non-iOS devices, capture the beforeinstallprompt event
    if (!isIOSDevice) {
      const handler = (e) => {
        // Prevent Chrome from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        setInstallPromptEvent(e);
        // Check if we should show our custom prompt
        checkIfShouldShowPrompt();
      };

      window.addEventListener('beforeinstallprompt', handler);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    } else {
      // For iOS, check if we should show Safari instructions
      checkIfShouldShowPrompt();
    }
  }, []);

  const checkIfShouldShowPrompt = () => {
    // Check if the user has dismissed the prompt before
    const promptDismissed = localStorage.getItem('pwaPromptDismissed');
    
    // Only show the prompt if user hasn't explicitly dismissed it
    // You could also add logic to not show it again for X days
    if (!promptDismissed) {
      // Don't show immediately - wait for user to interact with the site
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000); // Show after 30 seconds
    }
  };

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    
    // Show the browser's install prompt
    installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await installPromptEvent.userChoice;
    
    // Clear the saved prompt event - it can only be used once
    setInstallPromptEvent(null);
    setShowPrompt(false);
    
    // Optionally track the outcome for analytics
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  const handleDismiss = () => {
    // Remember that the user dismissed the prompt
    localStorage.setItem('pwaPromptDismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="app-install-prompt">
      {isIOS ? (
        <p>
          Install StackTrack: tap <span style={{ fontSize: '1.2em' }}>⎙</span> then "Add to Home Screen"
        </p>
      ) : (
        <p>Add StackTrack to your home screen for quick access!</p>
      )}
      <div className="app-install-actions">
        {!isIOS && (
          <button className="install-button" onClick={handleInstallClick}>
            Install
          </button>
        )}
        <button className="dismiss-button" onClick={handleDismiss}>
          Not Now
        </button>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;