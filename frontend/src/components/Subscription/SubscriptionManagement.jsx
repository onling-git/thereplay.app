// src/components/Subscription/SubscriptionManagement.jsx
import React, { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { 
  cancelSubscription, 
  reactivateSubscription, 
  createBillingPortalSession 
} from '../../api/subscriptionApi';
import './SubscriptionManagement.css';

const SubscriptionManagement = () => {
  const {
    subscription,
    hasActiveSubscription,
    loading,
    error,
    getPlanDisplayName,
    isSubscriptionEndingSoon,
    getDaysUntilRenewal,
    fetchSubscriptionStatus
  } = useSubscription();

  const [actionLoading, setActionLoading] = useState(null);

  const handleCancelSubscription = async (immediately = false) => {
    const confirmMessage = immediately 
      ? 'Are you sure you want to cancel your subscription immediately? You will lose access to premium features right away.'
      : 'Are you sure you want to cancel your subscription? You will continue to have access to premium features until the end of your current billing period.';
    
    if (!window.confirm(confirmMessage)) return;

    setActionLoading('cancel');
    try {
      await cancelSubscription(immediately);
      await fetchSubscriptionStatus();
      alert(immediately 
        ? 'Your subscription has been cancelled immediately.'
        : 'Your subscription will be cancelled at the end of the current period.'
      );
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!window.confirm('Are you sure you want to reactivate your subscription?')) return;

    setActionLoading('reactivate');
    try {
      await reactivateSubscription();
      await fetchSubscriptionStatus();
      alert('Your subscription has been reactivated successfully.');
    } catch (err) {
      console.error('Failed to reactivate subscription:', err);
      alert('Failed to reactivate subscription. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBillingPortal = async () => {
    setActionLoading('billing');
    try {
      const response = await createBillingPortalSession();
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Failed to create billing portal session:', err);
      alert('Failed to open billing portal. Please try again.');
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'subscription-card__status--active';
      case 'cancelled': return 'subscription-card__status--cancelled';
      case 'past_due': return 'subscription-card__status--past-due';
      default: return '';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getFeatureIcon = (enabled) => {
    return enabled ? '✓' : '✗';
  };

  const allFeatures = [
    { key: 'live_scores', label: 'Live Scores', alwaysEnabled: true },
    { key: 'premium_stats', label: 'Premium Statistics' },
    { key: 'multiple_teams', label: 'Follow Multiple Teams' },
    { key: 'ad_free', label: 'Ad-Free Experience' },
    { key: 'push_notifications', label: 'Push Notifications' },
    { key: 'exclusive_content', label: 'Exclusive Content' },
    { key: 'api_access', label: 'API Access' }
  ];

  if (loading) {
    return (
      <div className="subscription-management">
        <div className="subscription-loading">
          Loading subscription information...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-management">
        <div className="subscription-error">
          {error}
        </div>
      </div>
    );
  }

  if (!hasActiveSubscription) {
    return (
      <div className="subscription-management">
        <h1 className="subscription-management__title">Subscription Management</h1>
        
        <div className="no-subscription">
          <h2 className="no-subscription__title">No Active Subscription</h2>
          <p className="no-subscription__description">
            You don't currently have an active subscription. Upgrade to unlock premium features 
            and get the most out of your football experience.
          </p>
          <button 
            className="subscription-button subscription-button--primary"
            onClick={() => window.location.href = '/subscription/plans'}
          >
            View Subscription Plans
          </button>
        </div>
      </div>
    );
  }

  const daysUntilRenewal = getDaysUntilRenewal();
  const isEndingSoon = isSubscriptionEndingSoon();

  return (
    <div className="subscription-management">
      <h1 className="subscription-management__title">Subscription Management</h1>

      {isEndingSoon && subscription.status === 'active' && !subscription.cancel_at_period_end && (
        <div className="subscription-warning">
          <div className="subscription-warning__title">Subscription Renewal Notice</div>
          Your subscription will renew in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? 's' : ''}.
        </div>
      )}

      {subscription.cancel_at_period_end && (
        <div className="subscription-warning">
          <div className="subscription-warning__title">Subscription Cancellation Notice</div>
          Your subscription is set to cancel on {formatDate(subscription.current_period_end)}. 
          You will continue to have access to premium features until then.
        </div>
      )}

      <div className="subscription-card">
        <div className="subscription-card__header">
          <div>
            <h2 className="subscription-card__plan">{getPlanDisplayName()}</h2>
          </div>
          <div className={`subscription-card__status ${getStatusColor(subscription.status)}`}>
            {subscription.status}
          </div>
        </div>

        <div className="subscription-card__details">
          <div className="subscription-detail">
            <div className="subscription-detail__label">Current Period Start</div>
            <div className="subscription-detail__value">
              {formatDate(subscription.current_period_start)}
            </div>
          </div>
          
          <div className="subscription-detail">
            <div className="subscription-detail__label">
              {subscription.cancel_at_period_end ? 'Cancels On' : 'Next Renewal'}
            </div>
            <div className="subscription-detail__value">
              {formatDate(subscription.current_period_end)}
            </div>
          </div>

          {daysUntilRenewal !== null && (
            <div className="subscription-detail">
              <div className="subscription-detail__label">
                Days Until {subscription.cancel_at_period_end ? 'Cancellation' : 'Renewal'}
              </div>
              <div className="subscription-detail__value">
                {Math.max(0, daysUntilRenewal)}
              </div>
            </div>
          )}
        </div>

        <div className="subscription-card__actions">
          <button
            onClick={handleBillingPortal}
            disabled={actionLoading === 'billing'}
            className="subscription-button subscription-button--primary"
          >
            {actionLoading === 'billing' ? 'Loading...' : 'Manage Billing'}
          </button>

          {subscription.cancel_at_period_end ? (
            <button
              onClick={handleReactivateSubscription}
              disabled={actionLoading === 'reactivate'}
              className="subscription-button subscription-button--secondary"
            >
              {actionLoading === 'reactivate' ? 'Processing...' : 'Reactivate Subscription'}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleCancelSubscription(false)}
                disabled={actionLoading === 'cancel'}
                className="subscription-button subscription-button--danger"
              >
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel at Period End'}
              </button>
              
              <button
                onClick={() => handleCancelSubscription(true)}
                disabled={actionLoading === 'cancel'}
                className="subscription-button subscription-button--danger"
              >
                {actionLoading === 'cancel' ? 'Processing...' : 'Cancel Immediately'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="subscription-features">
        <h3 className="subscription-features__title">Your Features</h3>
        <div className="subscription-features__list">
          {allFeatures.map(feature => {
            const isEnabled = feature.alwaysEnabled || subscription.features?.[feature.key];
            return (
              <div 
                key={feature.key}
                className={`subscription-feature ${!isEnabled ? 'subscription-feature--disabled' : ''}`}
              >
                <span className={`subscription-feature__icon ${
                  isEnabled ? 'subscription-feature__icon--enabled' : 'subscription-feature__icon--disabled'
                }`}>
                  {getFeatureIcon(isEnabled)}
                </span>
                <span className="subscription-feature__label">{feature.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;