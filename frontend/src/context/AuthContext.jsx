//  COMPLETE FIXED: AuthContext.jsx - With Proper Logout Recording
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';

// Configure axios to include credentials (cookies) with all requests
axios.defaults.withCredentials = true;

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  token: localStorage.getItem('token'),
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token ?? state.token ?? localStorage.getItem('token'),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'INIT_AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'INIT_AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    default:
      return state;
  }
};

// Helper function to normalize user object
const normalizeUserObject = (userData, email = null) => {
  if (!userData) return null;
  
  const name = userData.full_name || 
               userData.name || 
               userData.Name || 
               userData.firstName || 
               userData.displayName || 
               'User';

  const photoCode = userData.photo_code ?? userData.Photo_Code ?? 0;
  const editedPhotoId = userData.edited_photo_id ?? userData.Edited_Photo_Id ?? null;
  const profilePhotoId = userData.profile_photo_id ?? userData.Profile_Photo_Id ?? null;
  
  let activePhoto = userData.profile_picture || userData.profilePicture || '';
  let activePhotoId = profilePhotoId;
  
  if (photoCode === 1 && editedPhotoId) {
    activePhotoId = editedPhotoId;
    if (userData.edited_photo_url || userData.Edited_Photo_URL) {
      activePhoto = userData.edited_photo_url || userData.Edited_Photo_URL;
    }
  } else {
    if (userData.registration_photo_url || userData.Registration_Photo_URL) {
      activePhoto = userData.registration_photo_url || userData.Registration_Photo_URL;
    }
  }

  return {
    id: userData.id || userData.Id || userData.user_id || userData.User_Id,
    name: name,
    full_name: name,
    displayName: name,
    firstName: userData.firstName || name.split(' ')[0],
    lastName: userData.lastName || name.split(' ').slice(1).join(' '),
    email: userData.email || email || userData.Email || '',
    phone_number: userData.phone_number || userData.phoneNumber || '',
    address: userData.address || '',
    country: userData.country || '',
    country_code: userData.country_code || '',
    languages: userData.languages || 'English',
    profile_picture: activePhoto,
    profile_photo_id: profilePhotoId,
    edited_photo_id: editedPhotoId,
    photo_code: photoCode,
    photo_id: activePhotoId,
    face_embedding_id: userData.face_embedding_id || userData.Face_Embedding_Id || null,
    role: userData.role || 'user',
    sessionTimeout: userData.sessionTimeout || userData.Session_Timeout,
    created_at: userData.created_at || userData.Created_At,
    updated_at: userData.updated_at || userData.Updated_At,
    status: userData.status !== undefined ? userData.status : (userData.Status !== 0),
    status_code: userData.status_code || userData.Status_Code || 0,
    agreeToTerms: userData.agreeToTerms !== undefined ? userData.agreeToTerms : !!userData.agree_to_terms,
  };
};

const fetchUserFromDB = async (id) => {
  const { data } = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.GET_USER_BY_ID}/${id}`);
  
  const photoCode = data.photo_code ?? 0;
  const profilePhotoId = data.profile_photo_id || null;
  const editedPhotoId = data.edited_photo_id || null;
  const activePhotoId = (photoCode === 1 && editedPhotoId) ? editedPhotoId : profilePhotoId;
  
  let profilePicture = '';
  if (activePhotoId) {
    try {
      const photoResponse = await axios.get(
        `${API_BASE_URL}/api/user-active-photo/${id}/?base64=false`
      );
      if (photoResponse.data?.s3_url) {
        profilePicture = photoResponse.data.s3_url;
      }
    } catch (photoErr) {
      console.warn('Could not fetch profile photo:', photoErr);
    }
  }

  return {
    id: data.ID,
    full_name: data.full_name,
    email: data.email,
    phone_number: data.phone_number || '',
    address: data.address || '',
    country: data.country || '',
    country_code: data.country_code || '',
    languages: data.languages ? data.languages.split(',').map(s => s.trim()).filter(Boolean) : [],
    status: data.Status !== 0,
    status_code: data.status_Code,
    agreeToTerms: !!data.agreeToTerms,
    profile_picture: profilePicture,
    profile_photo_id: profilePhotoId,
    edited_photo_id: editedPhotoId,
    photo_code: photoCode,
    photo_id: activePhotoId,
    face_embedding_id: data.face_embedding_id || null,
    created_at: data.Created_At,
    updated_at: data.Updated_At,
    name: data.full_name,
    displayName: data.full_name,
    firstName: (data.full_name || '').split(' ')[0] || data.full_name,
  };
};


export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const userData = JSON.parse(storedUser);
          const normalizedUser = normalizeUserObject(userData);
          
          dispatch({
            type: 'INIT_AUTH_SUCCESS',
            payload: {
              user: normalizedUser,
              token: token
            }
          });
          
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
          dispatch({ type: 'INIT_AUTH_FAILURE' });
        }
      } else {
        dispatch({ type: 'INIT_AUTH_FAILURE' });
      }
    };

    initializeAuth();
  }, []);

  // Listen for profile picture updates
  useEffect(() => {
    const handleProfilePictureUpdate = (event) => {
      console.log('🔐 AuthContext received profilePictureUpdated event:', event.detail);
      
      const { profile_picture, photo_code, user: updatedUser } = event.detail;
      
      if (updatedUser) {
        dispatch({
          type: 'UPDATE_PROFILE',
          payload: {
            profile_picture: updatedUser.profile_picture,
            profile_photo_id: updatedUser.profile_photo_id,
            edited_photo_id: updatedUser.edited_photo_id,
            photo_code: updatedUser.photo_code,
            face_embedding_id: updatedUser.face_embedding_id,
          }
        });
      }
    };

    window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate);

    return () => {
      window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    };
  }, []);

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      let locationData = {
        latitude: null,
        longitude: null,
        location_accuracy: null,
        location_source: 'unknown'
      };
      
      try {
        const position = await new Promise((resolve, reject) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos),
              (err) => reject(err),
              { 
                timeout: 5000, 
                enableHighAccuracy: true,
                maximumAge: 0
              }
            );
          } else {
            reject(new Error('Geolocation not supported'));
          }
        });
        
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          location_accuracy: position.coords.accuracy,
          location_source: 'browser_wifi'
        };
        console.log('📍 Location captured:', locationData);
      } catch (locErr) {
        console.log('📍 Location not available:', locErr.message);
      }

      const loginData = { 
        Credential: credentials.email, 
        Password: credentials.password,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_accuracy: locationData.location_accuracy,
        location_source: locationData.location_source
      };
      
      console.log('📤 Login data:', { ...loginData, Password: '***' });
      
      const { data } = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, loginData);

      const { Id } = data;

      const mockToken = `session_${Id}_${Date.now()}`;
      localStorage.setItem('token', mockToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;

      const normalized = await fetchUserFromDB(Id);

      localStorage.setItem('user', JSON.stringify(normalized));
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: normalized, token: mockToken } });
      
      // Fetch real profile photo after login
      try {
        const res = await axios.get(`${API_BASE_URL}/api/user-active-photo/${Id}/?base64=false`);
        if (res.data?.s3_url || res.data?.photo) {
          const photo = res.data.s3_url || res.data.photo;
          const photoCode = res.data.photo_code ?? normalized.photo_code ?? 0;
          const editedPhotoId = res.data.edited_photo_id ?? normalized.edited_photo_id ?? null;
          const profilePhotoId = res.data.registration_photo_id ?? res.data.profile_photo_id ?? normalized.profile_photo_id ?? null;

          const updatedUser = {
            ...normalized,
            profile_picture: photo,
            profile_photo: photo,
            photo_code: photoCode,
            edited_photo_id: editedPhotoId,
            profile_photo_id: profilePhotoId,
          };

          localStorage.setItem('user', JSON.stringify(updatedUser));
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: updatedUser, token: mockToken }
          });
        }
      } catch (err) {
        console.log("⚠ Failed to fetch photo after login", err);
      }
      return { user: normalized, token: mockToken, message: data?.Message };
    } catch (error) {
      const msg = error.response?.data?.Error || error.response?.data?.message || 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: msg });
      throw new Error(msg);
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'REGISTER_START' });
    try {
      if (!userData.profile_photo) {
        throw new Error('Profile photo is required');
      }

      const registerData = {
        full_name: userData.full_name,
        email: userData.email,
        password: userData.password,
        phone_number: userData.phone_number || null,
        address: userData.address || null,
        country: userData.country || null,
        country_code: userData.country_code || null,
        languages: userData.languages || 'English',
        profile_photo: userData.profile_photo,
        agreeToTerms: userData.agreeToTerms ? 1 : 0
      };
      
      const fullURL = `${API_BASE_URL}${API_ENDPOINTS.REGISTER}`;
      const response = await axios.post(fullURL, registerData);
      
      const userWithPhoto = {
        ...response.data,
        User_Id: response.data.User_Id,
        Photo_Id: response.data.Photo_Id,
        email: userData.email,
        full_name: userData.full_name
      };
      
      const normalizedUser = normalizeUserObject(userWithPhoto, userData.email);
      
      dispatch({ 
        type: 'REGISTER_SUCCESS',
        payload: { user: normalizedUser, token: null }
      });
      
      return normalizedUser;
    } catch (error) {
      console.error('🔐 Registration error:', error);
      
      const errorMessage = error.response?.data?.Error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Registration failed';
      
      dispatch({
        type: 'REGISTER_FAILURE',
        payload: errorMessage,
      });
      throw new Error(errorMessage);
    }
  };

  // ============================================================================
  // ✅ COMPLETELY FIXED LOGOUT FUNCTION
  // ============================================================================
  const logout = async () => {
    console.log('');
    console.log('🚪 ====================================================');
    console.log('🚪 [AuthContext] LOGOUT STARTED');
    console.log('🚪 ====================================================');
    
    // Get user ID BEFORE clearing anything
    const userId = state.user?.id || state.user?.Id || state.user?.user_id || state.user?.ID;
    
    console.log('🚪 [AuthContext] Current user state:', state.user);
    console.log('🚪 [AuthContext] User ID to logout:', userId);
    
    if (!userId) {
      console.warn('⚠️ [AuthContext] No user ID found - clearing local data only');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
      delete axios.defaults.headers.common['Authorization'];
      dispatch({ type: 'LOGOUT' });
      return;
    }

    try {
      // =====================================================================
      // STEP 1: Call backend logout API to record logout in database
      // =====================================================================
      const logoutUrl = `${API_BASE_URL}${API_ENDPOINTS.LOGOUT}`;
      console.log('📤 [AuthContext] Calling logout API:', logoutUrl);
      console.log('📤 [AuthContext] Sending User_Id:', userId);
      
      const response = await axios.post(
        logoutUrl,
        { 
          User_Id: userId,
          user_id: userId,  // Send both formats just in case
        },
        { 
          withCredentials: true,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ [AuthContext] Backend logout response:', response.data);
      
      if (response.data?.Logout_Recorded) {
        console.log('✅ [AuthContext] ✓ LOGOUT WAS RECORDED IN DATABASE!');
      } else {
        console.warn('⚠️ [AuthContext] Logout response received but Logout_Recorded is false');
        console.warn('⚠️ [AuthContext] This means the Status was NOT updated to logged_out');
      }
      
    } catch (error) {
      console.error('❌ [AuthContext] Backend logout API error:', error);
      console.error('❌ [AuthContext] Error details:', error?.response?.data || error.message);
      // Continue with local cleanup even if API fails
    }
    
    // =====================================================================
    // STEP 2: Clear all local data
    // =====================================================================
    console.log('🧹 [AuthContext] Clearing local storage and state...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    
    // =====================================================================
    // STEP 3: Update React state
    // =====================================================================
    dispatch({ type: 'LOGOUT' });
    
    // =====================================================================
    // STEP 4: Dispatch event for other components
    // =====================================================================
    window.dispatchEvent(new CustomEvent('userLoggedOut', {
      detail: { userId }
    }));
    
    console.log('🚪 ====================================================');
    console.log('🚪 [AuthContext] LOGOUT COMPLETED');
    console.log('🚪 ====================================================');
    console.log('');
  };

  const updateProfile = async (form) => {
    try {
      const userId = form.id ?? 
                     state.user?.id ?? 
                     state.user?.Id ?? 
                     state.user?.user_id ?? 
                     state.user?.ID;

      if (!userId) {
        throw new Error('User ID is required for profile update');
      }

      if (!form.full_name || form.full_name.trim() === '') {
        throw new Error('Full name is required');
      }

      const url = `${API_BASE_URL}/api/auth/update-profile/${userId}/`;

      const payload = {
        full_name: form.full_name.trim(),
        email: form.email?.trim() || state.user?.email || '',
        phone_number: form.phone_number || null,
        address: form.address || null,
        country: typeof form.country === 'object'
          ? (form.country?.value || form.country?.code || form.country?.name)
          : (form.country || null),
        languages: Array.isArray(form.languages)
          ? form.languages.filter(Boolean).join(', ')
          : (form.languages || 'English'),
        email_notifications: form.email_notifications ?? true,
        meeting_reminders: form.meeting_reminders ?? true,
        recording_notifications: form.recording_notifications ?? true,
        show_email: form.show_email ?? true,
        show_phone: form.show_phone ?? false,
        auto_join_audio: form.auto_join_audio ?? true,
        auto_join_video: form.auto_join_video ?? false,
      };

      const { data } = await axios.put(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });

      const serverUser = data.user ?? data;
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

      const normalized = {
        ...state.user,
        ...serverUser,
        full_name: serverUser.full_name || payload.full_name,
        name: serverUser.full_name || payload.full_name,
        displayName: serverUser.full_name || payload.full_name,
        languages: Array.isArray(serverUser?.languages)
          ? serverUser.languages
          : (typeof serverUser?.languages === 'string'
              ? serverUser.languages.split(',').map(s => s.trim()).filter(Boolean)
              : ['English']
            ),
        profile_picture: form.profile_picture || storedUser?.profile_picture || state.user?.profile_picture || serverUser?.profile_picture || '',
        profile_photo_id: form.profile_photo_id ?? storedUser?.profile_photo_id ?? state.user?.profile_photo_id ?? serverUser?.profile_photo_id ?? null,
        edited_photo_id: form.edited_photo_id ?? storedUser?.edited_photo_id ?? state.user?.edited_photo_id ?? serverUser?.edited_photo_id ?? null,
        photo_code: form.photo_code ?? storedUser?.photo_code ?? state.user?.photo_code ?? serverUser?.photo_code ?? 0,
        photo_id: form.photo_id ?? storedUser?.photo_id ?? state.user?.photo_id ?? serverUser?.photo_id ?? null,
        face_embedding_id: form.face_embedding_id ?? storedUser?.face_embedding_id ?? state.user?.face_embedding_id ?? serverUser?.face_embedding_id ?? null,
      };

      localStorage.setItem('user', JSON.stringify(normalized));
      
      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { user: normalized, token: state.token } 
      });

      window.dispatchEvent(new CustomEvent('userUpdated', {
        detail: { user: normalized }
      }));

      return { ok: true, user: normalized };
      
    } catch (err) {
      console.error('❌ Profile update failed:', err);
      
      const errorMessage = err?.response?.data?.Error || 
                          err?.response?.data?.error || 
                          err?.response?.data?.message || 
                          err.message || 
                          'Profile update failed';
      
      throw new Error(errorMessage);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`, { email: email });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.Error || error.response?.data?.message || 'Failed to send reset link');
    }
  };

  const resetPassword = async (data) => {
    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.RESET_PASSWORD}`, { 
        OTP: data.otp, 
        password: data.password,
        email: data.email
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.Error || error.response?.data?.message || 'Password reset failed');
    }
  };

  const verifyEmail = async (token) => {
    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.VERIFY_EMAIL}`, { token: token });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.Error || error.response?.data?.message || 'Email verification failed');
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.CHANGE_PASSWORD}`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.Error || error.response?.data?.message || 'Password change failed');
    }
  };

  const uploadProfilePicture = async (file) => {
    try {
      const formData = new FormData();
      formData.append('profile_picture', file);
      
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.UPLOAD_PROFILE_PICTURE}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const updatedUserData = { ...state.user, profile_picture: response.data.profile_picture };
      const normalizedUser = normalizeUserObject(updatedUserData);
      
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      dispatch({
        type: 'UPDATE_PROFILE',
        payload: normalizedUser
      });
      
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.Error || error.response?.data?.message || 'Failed to upload profile picture');
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const validateToken = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.VALIDATE_TOKEN}`);
      return response.data;
    } catch (error) {
      logout();
      throw new Error('Session expired');
    }
  };

  const value = {
    ...state,
    loading: state.isLoading,
    login,
    register,
    logout,
    updateProfile,
    forgotPassword,
    resetPassword,
    verifyEmail,
    changePassword,
    uploadProfilePicture,
    validateToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
  
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export const useAuth = useAuthContext;