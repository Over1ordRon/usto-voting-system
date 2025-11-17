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
    // Wait for all libraries to load
    window.addEventListener('load', function() {
      initApp();
    });

    function initApp() {
      const SUPABASE_URL = 'https://erozoxpkxevizzsilazx.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyb3pveHBreGV2aXp6c2lsYXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODMzMzUsImV4cCI6MjA3ODk1OTMzNX0.E6iZBm27I-HyS93obVvGO302KG3Wpf8I4n1_QeRE0yQ';
      const GOOGLE_CLIENT_ID = '337975458118-unpg0jnt0jq24h3mlumclknm5dbp09pg.apps.googleusercontent.com';
      const ADMIN_EMAILS = ['232335230820@etu.univ-usto.dz', '232337393613@etu.univ-usto.dz'];
      const ALLOWED_DOMAIN = '@etu.univ-usto.dz';

      const { useState, useEffect } = React;
      const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function VotingSystem() {
      const [user, setUser] = useState(null);
      const [polls, setPolls] = useState([]);
      const [loading, setLoading] = useState(true);
      const [showCreatePoll, setShowCreatePoll] = useState(false);
      const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });
      const [votedPolls, setVotedPolls] = useState(new Set());
      const [error, setError] = useState(null);

      useEffect(() => {
        checkAuth();
        loadPolls();
        initGoogle();

        const channel = supabaseClient
          .channel('db-changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, () => loadPolls())
          .subscribe();

        return () => supabaseClient.removeChannel(channel);
      }, []);

      function initGoogle() {
        const check = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(check);
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: handleGoogleLogin
            });
          }
        }, 100);
      }

      async function handleGoogleLogin(response) {
        try {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          
          if (!payload.email.endsWith(ALLOWED_DOMAIN)) {
            setError(`Only ${ALLOWED_DOMAIN} accounts allowed`);
            return;
          }

          const userData = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub,
            isAdmin: ADMIN_EMAILS.includes(payload.email)
          };

          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          await loadUserVotes(payload.sub);
          setError(null);
        } catch (err) {
          setError('Sign in failed');
          console.error(err);
        }
      }

      function checkAuth() {
        const saved = localStorage.getItem('user');
        if (saved) {
          try {
            const userData = JSON.parse(saved);
            setUser(userData);
            loadUserVotes(userData.sub);
          } catch {
            localStorage.removeItem('user');
          }
        }
        setLoading(false);
      }

      function signIn() {
        if (window.google?.accounts) {
          window.google.accounts.id.prompt();
        } else {
          setError('Google Sign-In not ready. Please refresh.');
        }
      }

      function signOut() {
        setUser(null);
        setVotedPolls(new Set());
        localStorage.removeItem('user');
      }

      async function hashUserId(userId) {
        const data = new TextEncoder().encode(userId);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      async function loadUserVotes(userSub) {
        try {
          const userHash = await hashUserId(userSub);
          const { data } = await supabaseClient
            .from('votes')
            .select('poll_id')
            .eq('user_hash', userHash);

          if (data) {
            setVotedPolls(new Set(data.map(v => v.poll_id)));
          }
        } catch (err) {
          console.error('Load votes error:', err);
        }
      }

      async function loadPolls() {
        try {
          const { data: pollsData } = await supabaseClient
            .from('polls')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });

          if (!pollsData) return;

          const pollsWithOptions = await Promise.all(
            pollsData.map(async (poll) => {
              const { data: options } = await supabaseClient
                .from('poll_options')
                .select('*')
                .eq('poll_id', poll.id)
                .order('id');

              return { ...poll, options: options || [] };
            })
          );

          setPolls(pollsWithOptions);
        } catch (err) {
          console.error('Load polls error:', err);
        }
      }

      async function createPoll() {
        const question = newPoll.question.trim();
        const options = newPoll.options.filter(o => o.trim());

        if (!question || options.length < 2) {
          alert('Please enter a question and at least 2 options');
          return;
        }

        try {
          const { data: poll } = await supabaseClient
            .from('polls')
            .insert({ question, active: true, created_by: user.email })
            .select()
            .single();

          await supabaseClient
            .from('poll_options')
            .insert(options.map(text => ({ poll_id: poll.id, text, votes: 0 })));

          setNewPoll({ question: '', options: ['', ''] });
          setShowCreatePoll(false);
          loadPolls();
          alert('Poll created!');
        } catch (err) {
          alert('Failed to create poll');
          console.error(err);
        }
      }

      async function vote(pollId, optionId) {
        if (votedPolls.has(pollId)) {
          alert('Already voted');
          return;
        }

        try {
          const userHash = await hashUserId(user.sub);

          const { data: existing } = await supabaseClient
            .from('votes')
            .select('id')
            .eq('poll_id', pollId)
            .eq('user_hash', userHash)
            .maybeSingle();

          if (existing) {
            alert('Already voted');
            setVotedPolls(prev => new Set(prev).add(pollId));
            return;
          }

          await supabaseClient
            .from('votes')
            .insert({ poll_id: pollId, user_hash: userHash });

          await supabaseClient.rpc('increment_vote', { option_id: optionId });

          setVotedPolls(prev => new Set(prev).add(pollId));
          loadPolls();
          alert('Vote recorded!');
        } catch (err) {
          alert('Vote failed');
          console.error(err);
        }
      }

      async function deletePoll(pollId) {
        if (!confirm('Delete this poll?')) return;

        try {
          await supabaseClient.from('votes').delete().eq('poll_id', pollId);
          await supabaseClient.from('poll_options').delete().eq('poll_id', pollId);
          await supabaseClient.from('polls').delete().eq('id', pollId);
          
          loadPolls();
          alert('Poll deleted!');
        } catch (err) {
          alert('Delete failed');
          console.error(err);
        }
      }

      if (loading) {
        return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center' },
          React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600' })
        );
      }

      if (!user) {
        return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4' },
          React.createElement('div', { className: 'bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center' },
            React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-2' }, 'University Voting'),
            React.createElement('p', { className: 'text-gray-600 mb-6' }, 'USTO Anonymous Voting System'),
            error && React.createElement('div', { className: 'bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4' }, error),
            React.createElement('button', {
              onClick: signIn,
              className: 'w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition'
            }, 'Sign in with Google'),
            React.createElement('p', { className: 'text-sm text-gray-500 mt-4' }, `Only ${ALLOWED_DOMAIN} accounts`)
          )
        );
      }

      return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' },
        React.createElement('header', { className: 'bg-white shadow-sm' },
          React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4 flex justify-between items-center' },
            React.createElement('h1', { className: 'text-xl font-bold text-gray-800' }, 'USTO Voting'),
            React.createElement('div', { className: 'flex items-center gap-4' },
              React.createElement('img', { src: user.picture, className: 'w-10 h-10 rounded-full' }),
              React.createElement('span', { className: 'text-sm font-semibold' }, user.name),
              user.isAdmin && React.createElement('span', { className: 'text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded' }, 'Admin'),
              React.createElement('button', {
                onClick: signOut,
                className: 'text-gray-600 hover:bg-gray-100 p-2 rounded-lg'
              }, 'Sign out')
            )
          )
        ),
        React.createElement('main', { className: 'max-w-4xl mx-auto px-4 py-8' },
          user.isAdmin && React.createElement('button', {
            onClick: () => setShowCreatePoll(!showCreatePoll),
            className: 'bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 mb-6'
          }, showCreatePoll ? 'Cancel' : 'Create Poll'),
          
          showCreatePoll && React.createElement('div', { className: 'bg-white rounded-xl shadow-lg p-6 mb-6' },
            React.createElement('input', {
              type: 'text',
              value: newPoll.question,
              onChange: e => setNewPoll({ ...newPoll, question: e.target.value }),
              placeholder: 'Question',
              className: 'w-full px-4 py-2 border rounded-lg mb-4'
            }),
            newPoll.options.map((opt, i) =>
              React.createElement('div', { key: i, className: 'flex gap-2 mb-2' },
                React.createElement('input', {
                  type: 'text',
                  value: opt,
                  onChange: e => {
                    const newOpts = [...newPoll.options];
                    newOpts[i] = e.target.value;
                    setNewPoll({ ...newPoll, options: newOpts });
                  },
                  placeholder: `Option ${i + 1}`,
                  className: 'flex-1 px-4 py-2 border rounded-lg'
                }),
                newPoll.options.length > 2 && React.createElement('button', {
                  onClick: () => setNewPoll({ 
                    ...newPoll, 
                    options: newPoll.options.filter((_, idx) => idx !== i) 
                  }),
                  className: 'px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg'
                }, '×')
              )
            ),
            React.createElement('button', {
              onClick: () => setNewPoll({ ...newPoll, options: [...newPoll.options, ''] }),
              className: 'text-indigo-600 text-sm mb-4'
            }, '+ Add Option'),
            React.createElement('button', {
              onClick: createPoll,
              className: 'w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700'
            }, 'Create Poll')
          ),

          React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, 'Active Polls'),
          polls.length === 0 ? 
            React.createElement('div', { className: 'bg-white rounded-xl shadow-lg p-12 text-center text-gray-500' }, 
              'No active polls'
            ) :
            polls.map(poll => {
              const hasVoted = votedPolls.has(poll.id);
              const total = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

              return React.createElement('div', { key: poll.id, className: 'bg-white rounded-xl shadow-lg p-6 mb-4' },
                React.createElement('div', { className: 'flex justify-between items-start mb-4' },
                  React.createElement('h3', { className: 'text-xl font-bold' }, poll.question),
                  user.isAdmin && React.createElement('button', {
                    onClick: () => deletePoll(poll.id),
                    className: 'text-red-600 hover:bg-red-50 px-3 py-1 rounded'
                  }, 'Delete')
                ),
                poll.options.map(opt => {
                  const pct = total > 0 ? ((opt.votes / total) * 100).toFixed(1) : 0;
                  
                  return React.createElement('div', { key: opt.id, className: 'mb-2' },
                    hasVoted ?
                      React.createElement('div', { className: 'relative border-2 rounded-lg overflow-hidden' },
                        React.createElement('div', { className: 'flex justify-between px-4 py-3 relative z-10' },
                          React.createElement('span', { className: 'font-medium' }, opt.text),
                          React.createElement('span', { className: 'font-semibold' }, `${pct}%`)
                        ),
                        React.createElement('div', {
                          className: 'absolute top-0 left-0 h-full bg-indigo-100',
                          style: { width: `${pct}%` }
                        })
                      ) :
                      React.createElement('button', {
                        onClick: () => vote(poll.id, opt.id),
                        className: 'w-full text-left px-4 py-3 border-2 rounded-lg hover:border-indigo-500 hover:bg-indigo-50'
                      }, opt.text)
                  );
                }),
                React.createElement('div', { className: 'mt-4 pt-4 border-t text-sm text-gray-500' },
                  `${total} ${total === 1 ? 'vote' : 'votes'}`,
                  hasVoted && React.createElement('span', { className: 'ml-4 text-green-600 font-medium' }, '✓ You voted')
                )
              );
            })
        )
      );
    }

      ReactDOM.render(React.createElement(VotingSystem), document.getElementById('root'));
    }
  </script>
</body>
</html>
