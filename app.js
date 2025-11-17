<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>USTO Voting System</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <div id="root"></div>

  <script>
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

      useEffect(function() {
        checkAuth();
        loadPolls();
        
        const initGoogle = function() {
          if (window.google && window.google.accounts) {
            console.log('Google Sign-In loaded successfully');
            initializeGoogleSignIn();
            setGoogleReady(true);
          } else {
            console.log('Waiting for Google Sign-In to load...');
            setTimeout(initGoogle, 500);
          }
        };
        
        setTimeout(initGoogle, 100);

        const pollsChannel = supabaseClient
          .channel('polls-changes')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'polls' },
            function(payload) {
              console.log('Polls changed:', payload);
              loadPolls();
            }
          )
          .subscribe();

        const optionsChannel = supabaseClient
          .channel('options-changes')
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'poll_options' },
            function(payload) {
              console.log('Options changed:', payload);
              loadPolls();
            }
          )
          .subscribe();

        return function() {
          supabaseClient.removeChannel(pollsChannel);
          supabaseClient.removeChannel(optionsChannel);
        };
      }, []);

      const initializeGoogleSignIn = function() {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          console.log('Google Sign-In initialized');
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err);
          setError('Failed to initialize Google Sign-In');
        }
      };

      const handleCredentialResponse = async function(response) {
        try {
          console.log('Received credential response');
          const credential = response.credential;
          const payload = JSON.parse(atob(credential.split('.')[1]));
          
          console.log('User email:', payload.email);
          
          if (!payload.email.endsWith(ALLOWED_DOMAIN)) {
            setError(`Only ${ALLOWED_DOMAIN} accounts are allowed`);
            return;
          }

          const userData = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            token: credential,
            sub: payload.sub
          };

          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          
          const isUserAdmin = adminEmails.includes(payload.email);
          setIsAdmin(isUserAdmin);
          console.log('Is admin:', isUserAdmin);
          
          await loadUserVotes(payload.sub);
          
          setError(null);
        } catch (err) {
          console.error('Error handling credential:', err);
          setError('Failed to sign in. Please try again.');
        }
      };

      const checkAuth = function() {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            setIsAdmin(adminEmails.includes(userData.email));
            loadUserVotes(userData.sub);
          } catch (err) {
            console.error('Error loading saved user:', err);
            localStorage.removeItem('user');
          }
        }
        setLoading(false);
      };

      const signIn = function() {
        if (window.google && window.google.accounts) {
          try {
            console.log('Prompting Google Sign-In...');
            window.google.accounts.id.prompt(function(notification) {
              console.log('Prompt notification:', notification);
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log('Prompt was not displayed, reason:', notification.getNotDisplayedReason());
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

      const signOut = function() {
        setUser(null);
        setIsAdmin(false);
        setVotedPolls(new Set());
        localStorage.removeItem('user');
        if (window.google && window.google.accounts) {
          window.google.accounts.id.disableAutoSelect();
        }
      };

      const loadUserVotes = async function(userSub) {
        try {
          const userHash = await hashUserId(userSub);
          const { data, error } = await supabaseClient
            .from('votes')
            .select('poll_id')
            .eq('user_hash', userHash);

          if (error) throw error;

          const votedPollIds = new Set(data.map(function(v) { return v.poll_id; }));
          setVotedPolls(votedPollIds);
        } catch (err) {
          console.error('Error loading user votes:', err);
        }
      };

      const loadPolls = async function() {
        try {
          const { data: pollsData, error: pollsError } = await supabaseClient
            .from('polls')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });

          if (pollsError) throw pollsError;

          const pollsWithOptions = await Promise.all(
            pollsData.map(async function(poll) {
              const { data: options, error: optionsError } = await supabaseClient
                .from('poll_options')
                .select('*')
                .eq('poll_id', poll.id)
                .order('id', { ascending: true });

              if (optionsError) throw optionsError;

              return {
                ...poll,
                options: options || []
              };
            })
          );

          setActivePolls(pollsWithOptions);
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

        const validOptions = newPoll.options.filter(opt => opt.trim());
        if (validOptions.length < 2) {
          alert('Please provide at least 2 options');
          return;
        }

        try {
          // First, sign in with Google token to set user session
          const { data: { session }, error: authError } = await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: user.token
          });

          if (authError) {
            console.error('Auth error:', authError);
            throw authError;
          }

          const { data: pollData, error: pollError } = await supabaseClient
            .from('polls')
            .insert([
              {
                question: newPoll.question,
                active: true,
                created_by: user.email
              }
            ])
            .select()
            .single();

          if (pollError) throw pollError;

          const optionsToInsert = validOptions.map(text => ({
            poll_id: pollData.id,
            text: text,
            votes: 0
          }));

          const { error: optionsError } = await supabaseClient
            .from('poll_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;

          setNewPoll({ question: '', options: ['', ''] });
          setShowCreatePoll(false);
          
          alert('Poll created successfully!');
          await loadPolls();
        } catch (err) {
          console.error('Error creating poll:', err);
          alert(`Failed to create poll: ${err.message}`);
        }
      };

      const hashUserId = async function(userId) {
        const encoder = new TextEncoder();
        const data = encoder.encode(userId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      };

      const vote = async function(pollId, optionId) {
        if (votedPolls.has(pollId)) {
          alert('You have already voted on this poll');
          return;
        }

        try {
          const userHash = await hashUserId(user.sub);

          // Check if already voted
          const { data: existingVote } = await supabaseClient
            .from('votes')
            .select('id')
            .eq('poll_id', pollId)
            .eq('user_hash', userHash)
            .maybeSingle();

          if (existingVote) {
            alert('You have already voted on this poll');
            setVotedPolls(prev => new Set(prev).add(pollId));
            return;
          }

          // Record the vote
          const { error: voteError } = await supabaseClient
            .from('votes')
            .insert([
              {
                poll_id: pollId,
                user_hash: userHash
              }
            ]);

          if (voteError) {
            console.error('Vote error:', voteError);
            throw voteError;
          }

          // Increment vote count using RPC function
          const { error: incrementError } = await supabaseClient
            .rpc('increment_vote', { option_id: optionId });

          if (incrementError) {
            console.error('Increment error:', incrementError);
            throw incrementError;
          }

          // Update local state
          setVotedPolls(function(prev) {
            const newSet = new Set(prev);
            newSet.add(pollId);
            return newSet;
          });

          // Reload polls to get updated counts
          await loadPolls();
          
          alert('Vote recorded successfully!');
        } catch (err) {
          console.error('Error voting:', err);
          alert(`Failed to record vote: ${err.message}`);
        }
      };

      const deletePoll = async function(pollId) {
        if (!confirm('Are you sure you want to delete this poll? This cannot be undone.')) {
          return;
        }

        try {
          // Sign in with Google token to authenticate
          const { data: { session }, error: authError } = await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: user.token
          });

          if (authError) {
            console.error('Auth error:', authError);
            throw authError;
          }

          // Delete poll options first
          const { error: optionsError } = await supabaseClient
            .from('poll_options')
            .delete()
            .eq('poll_id', pollId);

          if (optionsError) {
            console.error('Options delete error:', optionsError);
          }

          // Delete votes
          const { error: votesError } = await supabaseClient
            .from('votes')
            .delete()
            .eq('poll_id', pollId);

          if (votesError) {
            console.error('Votes delete error:', votesError);
          }

          // Delete the poll
          const { error: pollError } = await supabaseClient
            .from('polls')
            .delete()
            .eq('id', pollId);

          if (pollError) {
            console.error('Poll delete error:', pollError);
            throw pollError;
          }
          
          alert('Poll deleted successfully!');
          await loadPolls();
        } catch (err) {
          console.error('Error deleting poll:', err);
          alert(`Failed to delete poll: ${err.message}`);
        }
      };

      const addOption = function() {
        setNewPoll({ ...newPoll, options: [...newPoll.options, ''] });
      };

      const updateOption = function(index, value) {
        const newOptions = [...newPoll.options];
        newOptions[index] = value;
        setNewPoll({ ...newPoll, options: newOptions });
      };

      const removeOption = function(index) {
        if (newPoll.options.length <= 2) {
          alert('You must have at least 2 options');
          return;
        }
        const newOptions = newPoll.options.filter(function(_, i) { return i !== index; });
        setNewPoll({ ...newPoll, options: newOptions });
      };

      if (loading) {
        return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center' },
          React.createElement('div', { className: 'text-center' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4' }),
            React.createElement('div', { className: 'text-xl text-gray-600' }, 'Loading...')
          )
        );
      }

      if (!user) {
        return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4' },
          React.createElement('div', { className: 'bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center' },
            React.createElement('div', { className: 'bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6' },
              React.createElement('svg', { className: 'w-10 h-10 text-indigo-600', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' })
              )
            ),
            React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-2' }, 'University Voting'),
            React.createElement('p', { className: 'text-gray-600 mb-8' }, 'USTO Anonymous Voting System'),
            error && React.createElement('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm' }, error),
            !googleReady && React.createElement('div', { className: 'bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4 text-sm' }, 'Loading Google Sign-In... Please wait.'),
            React.createElement('div', { className: 'space-y-4' },
              React.createElement('button', {
                onClick: signIn,
                disabled: !googleReady,
                className: `w-full py-3 rounded-lg font-semibold transition duration-200 flex items-center justify-center gap-2 ${googleReady ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`
              },
                React.createElement('svg', { className: 'w-5 h-5', viewBox: '0 0 24 24' },
                  React.createElement('path', { fill: 'currentColor', d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' }),
                  React.createElement('path', { fill: 'currentColor', d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' }),
                  React.createElement('path', { fill: 'currentColor', d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' }),
                  React.createElement('path', { fill: 'currentColor', d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' })
                ),
                googleReady ? 'Sign in with Google' : 'Loading...'
              ),
              React.createElement('p', { className: 'text-sm text-gray-500' }, `Only ${ALLOWED_DOMAIN} accounts are allowed`)
            )
          )
        );
      }

      // Main app UI (when user is logged in)
      return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' },
        React.createElement('header', { className: 'bg-white shadow-sm' },
          React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4 flex items-center justify-between' },
            React.createElement('div', { className: 'flex items-center gap-3' },
              React.createElement('div', { className: 'bg-indigo-600 p-2 rounded-lg' },
                React.createElement('svg', { className: 'w-6 h-6 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' })
                )
              ),
              React.createElement('div', null,
                React.createElement('h1', { className: 'text-xl font-bold text-gray-800' }, 'USTO Voting'),
                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Anonymous Polling System')
              )
            ),
            React.createElement('div', { className: 'flex items-center gap-4' },
              React.createElement('div', { className: 'flex items-center gap-3' },
                React.createElement('img', { src: user.picture, alt: user.name, className: 'w-10 h-10 rounded-full' }),
                React.createElement('div', { className: 'text-right' },
                  React.createElement('p', { className: 'text-sm font-semibold text-gray-800' }, user.name),
                  React.createElement('p', { className: 'text-xs text-gray-500' }, isAdmin ? 'Admin' : 'Voter')
                )
              ),
              React.createElement('button', {
                onClick: signOut,
                className: 'p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition',
                title: 'Sign out'
              },
                React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' })
                )
              )
            )
          )
        ),
        React.createElement('main', { className: 'max-w-7xl mx-auto px-4 py-8' },
          error && React.createElement('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6' }, error),
          isAdmin && React.createElement('div', { className: 'mb-6' },
            React.createElement('button', {
              onClick: () => setShowCreatePoll(!showCreatePoll),
              className: 'bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2'
            },
              React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M12 4v16m8-8H4' })
              ),
              'Create New Poll'
            )
          ),
          showCreatePoll && isAdmin && React.createElement('div', { className: 'bg-white rounded-xl shadow-lg p-6 mb-6' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Create New Poll'),
            React.createElement('div', { className: 'space-y-4' },
              React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Question'),
                React.createElement('input', {
                  type: 'text',
                  value: newPoll.question,
                  onChange: function(e) { setNewPoll({ ...newPoll, question: e.target.value }); },
                  className: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  placeholder: 'Enter your question...'
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Options'),
                newPoll.options.map(function(option, idx) {
                  return React.createElement('div', { key: idx, className: 'flex gap-2 mb-2' },
                    React.createElement('input', {
                      type: 'text',
                      value: option,
                      onChange: function(e) { updateOption(idx, e.target.value); },
                      className: 'flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                      placeholder: 'Option ' + (idx + 1)
                    }),
                    newPoll.options.length > 2 && React.createElement('button', {
                      onClick: function() { removeOption(idx); },
                      className: 'p-2 text-red-600 hover:bg-red-50 rounded-lg transition'
                    },
                      React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                      )
                    )
                  );
                }),
                React.createElement('button', {
                  onClick: addOption,
                  className: 'text-indigo-600 text-sm font-medium hover:text-indigo-700 mt-2'
                }, '+ Add Option')
              ),
              React.createElement('div', { className: 'flex gap-3' },
                React.createElement('button', {
                  onClick: createPoll,
                  className: 'bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition'
                }, 'Create Poll'),
                React.createElement('button', {
                  onClick: function() {
                    setShowCreatePoll(false);
                    setNewPoll({ question: '', options: ['', ''] });
                  },
                  className: 'bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition'
                }, 'Cancel')
              )
            )
          ),
          React.createElement('div', { className: 'space-y-6' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Active Polls'),
            activePolls.length === 0 ? React.createElement('div', { className: 'bg-white rounded-xl shadow-lg p-12 text-center' },
              React.createElement('svg', { className: 'w-16 h-16 text-gray-300 mx-auto mb-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
              ),
              React.createElement('p', { className: 'text-gray-500 text-lg' }, 'No active polls at the moment')
            ) : activePolls.map(function(poll) {
              const hasVoted = votedPolls.has(poll.id);
              const totalVotes = poll.options.reduce(function(sum, opt) { return sum + opt.votes; }, 0);
              
              return React.createElement('div', { key: poll.id, className: 'bg-white rounded-xl shadow-lg p-6' },
                React.createElement('div', { className: 'flex justify-between items-start mb-4' },
                  React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, poll.question),
                  isAdmin && React.createElement('button', {
                    onClick: function() { deletePoll(poll.id); },
                    className: 'p-2 text-red-600 hover:bg-red-50 rounded-lg transition',
                    title: 'Delete poll'
                  },
                    React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                    )
                  )
                ),
                React.createElement('div', { className: 'space-y-3' },
                  poll.options.map(function(option) {
                    const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;
                    
                    return React.createElement('div', { key: option.id },
                      !hasVoted ? React.createElement('button', {
                        onClick: function() { vote(poll.id, option.id); },
                        className: 'w-full text-left px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition'
                      }, option.text) : React.createElement('div', { className: 'relative overflow-hidden rounded-lg border-2 border-gray-200' },
                        React.createElement('div', { className: 'flex justify-between items-center px-4 py-3 relative z-10' },
                          React.createElement('span', { className: 'font-medium text-gray-800' }, option.text),
                          React.createElement('span', { className: 'text-sm text-gray-600 font-semibold' }, percentage + '%')
                        ),
                        React.createElement('div', {
                          className: 'absolute top-0 left-0 h-full bg-indigo-100 transition-all duration-500',
                          style: { width: percentage + '%' }
                        })
                      )
                    );
                  })
                ),
                React.createElement('div', { className: 'mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500' },
                  React.createElement('span', { className: 'flex items-center gap-2' },
                    React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' })
                    ),
                    `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`
                  ),
                  hasVoted && React.createElement('span', { className: 'flex items-center gap-1 text-green-600 font-medium' },
                    React.createElement('svg', { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M5 13l4 4L19 7' })
                    ),
                    'You voted'
                  )
                )
              );
            })
          )
        )
      );
    };

    ReactDOM.render(React.createElement(VotingSystem), document.getElementById('root'));
  </script>
</body>
</html>
