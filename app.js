// ============================================
// CONFIGURATION - REPLACE WITH YOUR VALUES
// ============================================
const SUPABASE_URL = 'https://erozoxpkxevizzsilazx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyb3pveHBreGV2aXp6c2lsYXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODMzMzUsImV4cCI6MjA3ODk1OTMzNX0.E6iZBm27I-HyS93obVvGO302KG3Wpf8I4n1_QeRE0yQ';
const GOOGLE_CLIENT_ID = '337975458118-unpg0jnt0jq24h3mlumclknm5dbp09pg.apps.googleusercontent.com';

const adminEmails = [
  '232335230820@etu.univ-usto.dz',
  '232337393613@etu.univ-usto.dz'
];

const ALLOWED_DOMAIN = '@etu.univ-usto.dz';

// ============================================
// APPLICATION CODE
// ============================================
const { useState, useEffect } = React;
const { createClient } = supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VotingSystem = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activePolls, setActivePolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });
  const [votedPolls, setVotedPolls] = useState(new Set());
  const [error, setError] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    checkAuth();
    loadPolls();

    // init google sign-in polling
    let googleInitTimer = null;
    const initGoogle = () => {
      if (window.google && window.google.accounts) {
        initializeGoogleSignIn();
        setGoogleReady(true);
      } else {
        googleInitTimer = setTimeout(initGoogle, 500);
      }
    };
    googleInitTimer = setTimeout(initGoogle, 100);

    // realtime subscriptions (Supabase v2 style channel)
    const pollsChannel = supabaseClient
      .channel('polls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => loadPolls()
      )
      .subscribe();

    const optionsChannel = supabaseClient
      .channel('options-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_options' },
        () => loadPolls()
      )
      .subscribe();

    return () => {
      if (googleInitTimer) clearTimeout(googleInitTimer);
      try {
        supabaseClient.removeChannel(pollsChannel);
      } catch (e) {
        // some supabase clients use removeChannel; ignore if not supported
      }
      try {
        supabaseClient.removeChannel(optionsChannel);
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeGoogleSignIn = () => {
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    } catch (err) {
      console.error('Error initializing Google Sign-In:', err);
      setError('Failed to initialize Google Sign-In');
    }
  };

  const handleCredentialResponse = async (response) => {
    try {
      if (!response || !response.credential) {
        setError('Invalid Google response');
        return;
      }

      const credential = response.credential;
      const payload = JSON.parse(atob(credential.split('.')[1]));

      if (!payload.email || !payload.email.endsWith(ALLOWED_DOMAIN)) {
        setError(`Only ${ALLOWED_DOMAIN} accounts are allowed`);
        return;
      }

      // Sign in with Supabase using Google ID token
      try {
        const { data: authData, error: authError } =
          await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: credential,
          });

        if (authError) {
          console.error('Supabase auth error:', authError);
          setError('Failed to authenticate with the backend. Please try again.');
          return;
        }
      } catch (authErr) {
        console.error('Supabase auth exception:', authErr);
        setError('Failed to authenticate with the backend. Please try again.');
        return;
      }

      const userData = {
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture || '',
        token: credential,
        sub: payload.sub,
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      setIsAdmin(adminEmails.includes(payload.email));
      await loadUserVotes(payload.sub);
      setError(null);
    } catch (err) {
      console.error('Error handling credential:', err);
      setError('Failed to sign in. Please try again.');
    }
  };

  const checkAuth = () => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAdmin(adminEmails.includes(userData.email));
        if (userData.sub) loadUserVotes(userData.sub);
      } catch (err) {
        console.error('Error loading saved user:', err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  };

  const signIn = () => {
    if (window.google && window.google.accounts) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setError('Please allow popups and ensure third-party cookies are enabled');
          }
        });
      } catch (err) {
        console.error('Error prompting sign in:', err);
        setError('Failed to open sign-in. Please refresh the page and try again.');
      }
    } else {
      setError('Google Sign-In is still loading. Please wait a moment and try again.');
    }
  };

  const signOut = async () => {
    setUser(null);
    setIsAdmin(false);
    setVotedPolls(new Set());
    localStorage.removeItem('user');
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut failed (non-blocking):', e);
    }
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const loadUserVotes = async (userSub) => {
    try {
      if (!userSub) return;
      const userHash = await hashUserId(userSub);
      const { data, error } = await supabaseClient
        .from('votes')
        .select('poll_id')
        .eq('user_hash', userHash);

      if (error) throw error;
      const votedPollIds = new Set((data || []).map((v) => v.poll_id));
      setVotedPolls(votedPollIds);
    } catch (err) {
      console.error('Error loading user votes:', err);
    }
  };

  const loadPolls = async () => {
    try {
      // calling RPC that returns joined rows: poll + option rows
      const { data, error } = await supabaseClient.rpc('get_active_polls');

      if (error) throw error;

      const pollsMap = new Map();
      (data || []).forEach((row) => {
        const pollId = row.poll_id;
        if (!pollsMap.has(pollId)) {
          pollsMap.set(pollId, {
            id: pollId,
            question: row.question,
            created_at: row.created_at,
            options: [],
          });
        }
        if (row.option_id != null) {
          pollsMap.get(pollId).options.push({
            id: row.option_id,
            text: row.option_text,
            votes: row.votes || 0,
          });
        }
      });

      setActivePolls(Array.from(pollsMap.values()));
    } catch (err) {
      console.error('Error loading polls:', err);
      setError('Failed to load polls. Please refresh the page.');
    }
  };

  const createPoll = async () => {
    if (!newPoll.question.trim()) {
      alert('Please enter a question');
      return;
    }

    const validOptions = newPoll.options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      alert('Please provide at least 2 options');
      return;
    }

    if (!user) {
      alert('You must be signed in to create a poll');
      return;
    }

    try {
      const { data: pollData, error: pollError } = await supabaseClient
        .from('polls')
        .insert([
          {
            question: newPoll.question,
            active: true,
            created_by: user.email,
          },
        ])
        .select()
        .single();

      if (pollError) throw pollError;

      const optionsToInsert = validOptions.map((text) => ({
        poll_id: pollData.id,
        text,
        votes: 0,
      }));

      const { error: optionsError } = await supabaseClient
        .from('poll_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      setNewPoll({ question: '', options: ['', ''] });
      setShowCreatePoll(false);
      await loadPolls();
      alert('Poll created successfully!');
    } catch (err) {
      console.error('Error creating poll:', err);
      alert('Failed to create poll. Please try again.');
    }
  };

  const hashUserId = async (userId) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const vote = async (pollId, optionId) => {
    if (!user) {
      alert('Please sign in first');
      return;
    }
    if (votedPolls.has(pollId)) {
      alert('You have already voted on this poll');
      return;
    }

    try {
      const userHash = await hashUserId(user.sub);

      // server-side check via RPC
      const { data: hasVoted, error: hasVotedError } =
        await supabaseClient.rpc('has_user_voted', {
          poll_id_param: pollId,
          user_hash_param: userHash,
        });

      if (hasVotedError) throw hasVotedError;

      if (hasVoted) {
        const newVoted = new Set(votedPolls);
        newVoted.add(pollId);
        setVotedPolls(newVoted);
        alert('You have already voted on this poll');
        return;
      }

      const { error: voteError } = await supabaseClient.from('votes').insert([
        {
          poll_id: pollId,
          user_hash: userHash,
        },
      ]);

      if (voteError) {
        // check for custom constraint message
        if (
          voteError.message &&
          voteError.message.includes('User has already voted on this poll')
        ) {
          const newVoted = new Set(votedPolls);
          newVoted.add(pollId);
          setVotedPolls(newVoted);
          alert('You have already voted on this poll');
          return;
        }
        throw voteError;
      }

      const { error: incError } = await supabaseClient.rpc('increment_vote', {
        option_id: optionId,
      });

      if (incError) throw incError;

      const newVoted = new Set(votedPolls);
      newVoted.add(pollId);
      setVotedPolls(newVoted);

      await loadPolls();
      alert('Vote recorded successfully!');
    } catch (err) {
      console.error('Error voting:', err);
      alert('Failed to record vote. Please try again.');
    }
  };

  const deletePoll = async (pollId) => {
    if (!confirm('Are you sure you want to delete this poll? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabaseClient.rpc('admin_delete_poll', {
        poll_id_param: pollId,
      });

      if (error) throw error;

      alert('Poll deleted successfully!');
      await loadPolls();
    } catch (err) {
      console.error('Error deleting poll:', err);
      alert('Failed to delete poll. Please try again.');
    }
  };

  const addOption = () => {
    setNewPoll({ ...newPoll, options: [...newPoll.options, ''] });
  };

  const updateOption = (index, value) => {
    const newOptions = [...newPoll.options];
    newOptions[index] = value;
    setNewPoll({ ...newPoll, options: newOptions });
  };

  const removeOption = (index) => {
    if (newPoll.options.length <= 2) {
      alert('You must have at least 2 options');
      return;
    }
    const newOptions = newPoll.options.filter((_, i) => i !== index);
    setNewPoll({ ...newPoll, options: newOptions });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">University Voting</h1>
          <p className="text-gray-600 mb-8">USTO Anonymous Voting System</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {!googleReady && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4 text-sm">
              Loading Google Sign-In... Please wait.
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={signIn}
              disabled={!googleReady}
              className={`w-full py-3 rounded-lg font-semibold transition duration-200 flex items-center justify-center gap-2 ${
                googleReady ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleReady ? 'Sign in with Google' : 'Loading...'}
            </button>

            <p className="text-sm text-gray-500">Only {ALLOWED_DOMAIN} accounts are allowed</p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-2">Troubleshooting:</p>
            <ul className="text-xs text-gray-500 text-left space-y-1">
              <li>• Enable popups for this site</li>
              <li>• Allow third-party cookies</li>
              <li>• Check browser console (F12) for errors</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">USTO Voting</h1>
              <p className="text-sm text-gray-500">Anonymous Polling System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-500">{isAdmin ? 'Admin' : 'Voter'}</p>
              </div>
            </div>
            <button onClick={signOut} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Sign out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isAdmin && (
          <div className="mb-6">
            <button onClick={() => setShowCreatePoll(!showCreatePoll)} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Poll
            </button>
          </div>
        )}

        {showCreatePoll && isAdmin && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Create New Poll</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                <input
                  type="text"
                  value={newPoll.question}
                  onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your question..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>

                {newPoll.options.map((option, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder={`Option ${idx + 1}`}
                    />
                    {newPoll.options.length > 2 && (
                      <button onClick={() => removeOption(idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Remove option">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862A2 2 0 015.867 19.142L5 7m5 4v6m4-6v6M9 4h6" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                <button onClick={addOption} className="text-indigo-600 text-sm font-medium hover:text-indigo-700 mt-2">
                  + Add Option
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={createPoll} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">Create Poll</button>
                <button onClick={() => { setShowCreatePoll(false); setNewPoll({ question: '', options: ['', ''] }); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">Active Polls</h2>

          {activePolls.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
              </svg>
              <p className="text-gray-500 text-lg">No active polls at the moment</p>
            </div>
          ) : (
            activePolls.map((poll) => {
              const hasVoted = votedPolls.has(poll.id);
              const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

              return (
                <div key={poll.id} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{poll.question}</h3>
                    {isAdmin && (
                      <button onClick={() => deletePoll(poll.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete poll">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862A2 2 0 015.867 19.142L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {poll.options.map((option) => {
                      const votes = option.votes || 0;
                      const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;

                      return (
                        <div key={option.id}>
                          {!hasVoted ? (
                            <button onClick={() => vote(poll.id, option.id)} className="w-full text-left px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition">
                              {option.text}
                            </button>
                          ) : (
                            <div className="relative overflow-hidden rounded-lg border-2 border-gray-200">
                              <div className="flex justify-between items-center px-4 py-3 relative z-10">
                                <span className="font-medium text-gray-800">{option.text}</span>
                                <span className="text-sm text-gray-600 font-semibold">{percentage}%</span>
                              </div>
                              <div className="absolute top-0 left-0 h-full bg-indigo-100 transition-all duration-500" style={{ width: `${percentage}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857" />
                      </svg>
                      {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                    </span>

                    {hasVoted && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        You voted
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<VotingSystem />);
