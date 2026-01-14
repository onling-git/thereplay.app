// src/utils/dateUtils.js

export const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Check if it's today
  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  
  // Check if it's tomorrow
  if (d.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }
  
  // Check if it's within this week
  const diffTime = d.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 0 && diffDays <= 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  // Return formatted date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
};

export const formatTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDateTime = (date) => {
  if (!date) return '';
  
  return `${formatDate(date)} ${formatTime(date)}`;
};

export const isUpcoming = (date) => {
  if (!date) return false;
  return new Date(date) > new Date();
};

export const isPast = (date) => {
  if (!date) return false;
  return new Date(date) < new Date();
};

export const getTimeUntilMatch = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  
  if (diff <= 0) return 'Match started';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};