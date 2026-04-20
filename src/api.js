// API Endpoints for Google Sheets Backend
export const API_URL = "https://script.google.com/macros/s/AKfycbw55ZnPhKMRIV_y1OoqhJEuhovL4_w8fikg4ARvFx_O7X9zHhiP3clE2F6-hDnXechNCw/exec";

export const fetchApi = async (action) => {
  try {
    const response = await fetch(`${API_URL}?action=${action}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${action}:`, error);
    return [];
  }
};

export const postApi = async (data) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      } // Using text/plain to avoid CORS preflight issues with Google Apps Script
    });
    return await response.json();
  } catch (error) {
    console.error("Error posting data:", error);
    return { error: error.message };
  }
};
