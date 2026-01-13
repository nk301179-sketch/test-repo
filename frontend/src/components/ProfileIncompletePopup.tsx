import { useState, useEffect } from 'react';
import './ProfileIncompletePopup.css';
import { buildUserMgmtUrl } from '../services/userMgmt';

interface ProfileIncompletePopupProps {
  onDismiss: () => void;
}

const ProfileIncompletePopup = ({ onDismiss }: ProfileIncompletePopupProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleCompleteProfile = () => {
    onDismiss();
    window.location.replace(buildUserMgmtUrl('/complete-profile', window.location.href));
  };

  const handleLater = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div className={`profile-popup-overlay ${isVisible ? 'visible' : ''}`} onClick={handleLater}>
      <div className={`profile-popup ${isVisible ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="profile-popup-header">
          <div className="profile-popup-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <h2 className="profile-popup-title">Complete Your Profile</h2>
        </div>
        <p className="profile-popup-message">
          Your profile is incomplete. Please complete your profile to access all features.
        </p>
        <div className="profile-popup-actions">
          <button className="profile-popup-button profile-popup-button-primary" onClick={handleCompleteProfile}>
            Complete Profile
          </button>
          <button className="profile-popup-button profile-popup-button-secondary" onClick={handleLater}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileIncompletePopup;



