export const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
