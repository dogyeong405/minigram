import { useState, useEffect } from 'react'
import { Home, Search, PlusSquare, Heart, User, MoreHorizontal, MessageCircle, Send, X, LogOut } from 'lucide-react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(null)
  const [posts, setPosts] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('home')

  // Check auth status on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchPosts(session.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchPosts(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPosts(userId = null) {
    try {
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (postsError) throw postsError

      // If user is logged in, fetch their likes and all comments to attach to posts
      if (userId && postsData) {
        // Fetch likes
        const { data: likesData } = await supabase
          .from('likes')
          .select('post_id')
        
        // Fetch comments
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*')
          .order('created_at', { ascending: true })

        // Process posts to include like count, user's like status, and comments
        const processedPosts = postsData.map(post => {
          const postLikes = likesData?.filter(l => l.post_id === post.id) || []
          const postComments = commentsData?.filter(c => c.post_id === post.id) || []
          
          return {
            ...post,
            likesCount: postLikes.length,
            isLikedByMe: postLikes.some(l => l.user_id === userId),
            comments: postComments
          }
        })
        setPosts(processedPosts)
      } else if (postsData) {
         setPosts(postsData.map(p => ({...p, likesCount: 0, isLikedByMe: false, comments: []})))
      }
    } catch (error) {
      console.error('Error fetching data:', error.message)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading Minigram...</div>
  }

  // Show Login Screen if not authenticated
  if (!session) {
    return <AuthScreen onAdminBypass={(adminUser) => {
      setSession({ user: adminUser.user })
      fetchPosts(adminUser.user.id)
    }} />
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="logo notranslate" translate="no">
          <span className="logo-text">Minigram</span>
        </div>
        <div className="nav-links">
          <div className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => setCurrentView('home')}>
            <Home size={24} />
            <span translate="no" className="nav-text notranslate">홈</span>
          </div>
          <div className={`nav-item ${currentView === 'search' ? 'active' : ''}`} onClick={() => setCurrentView('search')}>
            <Search size={24} />
            <span translate="no" className="nav-text notranslate">검색</span>
          </div>
          <div className="nav-item" onClick={() => setIsModalOpen(true)}>
            <PlusSquare size={24} />
            <span translate="no" className="nav-text notranslate">만들기</span>
          </div>
          <div className="nav-item title-only-mobile" onClick={async () => {
            if (window.confirm('정말 로그아웃하시겠습니까?')) {
              await supabase.auth.signOut()
              setSession(null)
              setCurrentView('home')
            }
          }}>
             <LogOut size={24} />
             <span translate="no" className="nav-text notranslate">로그아웃</span>
          </div>
          <div className={`nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => setCurrentView('profile')}>
            <div className="avatar" style={{width: 24, height: 24, padding: 0}}>
               <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${session.user.id}`} alt="my profile" />
            </div>
            <span translate="no" className="nav-text notranslate" style={{fontWeight: 600}}>프로필</span>
          </div>
        </div>
      </nav>

      {/* Main Content Areas */}
      <main className="main-content">
        {currentView === 'home' && (
          <div className="feed-container">
            {posts.map(post => (
              <Post 
                key={post.id} 
                post={post} 
                currentUser={session.user} 
                onInteract={() => fetchPosts(session.user.id)} 
              />
            ))}
            {posts.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
                아직 게시물이 없습니다. 첫 게시물을 공유해 보세요!
              </div>
            )}
          </div>
        )}
        {currentView === 'search' && <SearchScreen allPosts={posts} />}
        {currentView === 'profile' && <ProfileScreen user={session.user} allPosts={posts} />}
      </main>

      {/* Create Post Modal */}
      {isModalOpen && (
        <CreatePostModal 
          user={session.user}
          onClose={() => setIsModalOpen(false)} 
          onPostCreated={() => {
            setIsModalOpen(false)
            fetchPosts(session.user.id)
          }} 
        />
      )}
    </div>
  )
}

// ============== Auth Component ==============
function AuthScreen({ onAdminBypass }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [statusMsg, setStatusMsg] = useState({ text: '', isError: false })

  // Easter Egg State
  const [clickSequence, setClickSequence] = useState([])
  const targetSequence = ['M', 'g', 'n', 'r'] 

  const handleCharClick = (char) => {
    const newSequence = [...clickSequence, char]
    
    // Check if the sequence matches so far
    let isMatch = true
    for (let i = 0; i < newSequence.length; i++) {
      if (newSequence[i] !== targetSequence[i]) {
        isMatch = false
        break
      }
    }

    if (isMatch) {
      if (newSequence.length === targetSequence.length) {
        // Full sequence match! Trigger Easter Egg
        alert("🎉 관리자 모드(이스터에그) 활성화! 임시 관리자 계정으로 진입합니다.")
        onAdminBypass({
          user: {
            id: '99999999-9999-4999-b999-999999999999',
            email: 'admin@minigram.com'
          }
        })
      } else {
        setClickSequence(newSequence)
      }
    } else {
      // Reset if wrong sequence
      setClickSequence([])
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatusMsg({ text: '', isError: false })
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setStatusMsg({ text: '가입에 성공했습니다! 이제 로그인할 수 있습니다.', isError: false })
        setIsLogin(true) // optionally switch to login view
      }
    } catch (error) {
      // Translate common error messages
      let kMsg = error.message
      if (kMsg.includes('Invalid login credentials')) {
        kMsg = '가입되지 않은 이메일이거나 비밀번호가 틀렸습니다.'
      } else if (kMsg.includes('User already registered') || kMsg.includes('already registered')) {
        kMsg = '이미 가입된 이메일입니다.'
      } else if (kMsg.includes('Password should be at least')) {
        kMsg = '비밀번호는 최소 6자리 이상이어야 합니다.'
      } else if (kMsg.includes('Email link is invalid') || kMsg.includes('validate email address') || kMsg.toLowerCase().includes('invalid email')) {
         kMsg = '유효하지 않은 이메일 형식입니다. 정확한 이메일 주소를 입력해주세요.'
      } else if (kMsg.toLowerCase().includes('rate limit')) {
         kMsg = '과도한 요청이 발생했습니다. 잠시 후(약 1시간 뒤) 다시 시도해주세요.'
      }
      setStatusMsg({ text: kMsg, isError: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div translate="no" className="notranslate" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fafafa' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', border: '1px solid #dbdbdb', borderRadius: '10px', width: '350px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Inter', fontSize: '32px', marginBottom: '30px', userSelect: 'none', position: 'relative', display: 'inline-block' }}>
          <span translate="no" className="notranslate">Minigram</span>
          {/* Invisible overlay for Easter Egg clicks so the text translates as one word */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', opacity: 0 }}>
            <span onClick={() => handleCharClick('M')} style={{ width: '16%', cursor: 'pointer' }}></span>
            <span style={{ width: '8%' }}></span>
            <span onClick={() => handleCharClick('n')} style={{ width: '12%', cursor: 'pointer' }}></span>
            <span style={{ width: '8%' }}></span>
            <span onClick={() => handleCharClick('g')} style={{ width: '14%', cursor: 'pointer' }}></span>
            <span onClick={() => handleCharClick('r')} style={{ width: '10%', cursor: 'pointer' }}></span>
            <span style={{ width: '32%' }}></span>
          </div>
        </h1>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {statusMsg.text && (
            <div style={{ color: statusMsg.isError ? '#ed4956' : '#28a745', fontSize: '14px', marginBottom: '5px', fontWeight: '500' }}>
              {statusMsg.text}
            </div>
          )}
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #dbdbdb', backgroundColor: '#fafafa' }}
            required
          />
          <input
            type="password"
            placeholder="비밀번호 (최소 6자리)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #dbdbdb', backgroundColor: '#fafafa' }}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ backgroundColor: '#0095f6', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            {loading ? '처리중...' : (isLogin ? '로그인' : '가입하기')}
          </button>
        </form>
        
        <div style={{ marginTop: '20px', fontSize: '14px' }}>
          {isLogin ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
          <span 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: '#0095f6', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {isLogin ? '가입하기' : '로그인'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============== Post Component ==============
function Post({ post, currentUser, onInteract }) {
  const [commentText, setCommentText] = useState('')
  const [isLiking, setIsLiking] = useState(false)
  const [isCommenting, setIsCommenting] = useState(false)

  const handleLike = async () => {
    if (isLiking) return
    setIsLiking(true)
    try {
      if (post.isLikedByMe) {
        // Unlike: delete the row
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUser.id })
      } else {
        // Like: insert a row
        await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser.id }])
      }
      onInteract() // Refresh data
    } catch (error) {
      console.error('Error toggling like:', error)
    } finally {
      setIsLiking(false)
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || isCommenting) return
    
    setIsCommenting(true)
    try {
      await supabase.from('comments').insert([
        { post_id: post.id, user_id: currentUser.id, content: commentText.trim() }
      ])
      setCommentText('')
      onInteract() // Refresh data
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsCommenting(false)
    }
  }

  // Format date simply
  const dateObj = new Date(post.created_at)
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Determine post author display name
  const authorName = post.user_id ? `user_${post.user_id.substring(0,6)}` : `user_${post.id?.toString().substring(0,4)}`

  return (
    <article className="post">
      <div className="post-header">
        <div className="avatar">
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${post.user_id || post.id}`} alt="avatar" />
        </div>
        <span className="username notranslate" translate="no">{authorName}</span>
        <MoreHorizontal size={20} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
      </div>

      <img src={post.image_url} alt="Post content" className="post-image" />

      <div className="post-actions">
        <Heart 
          size={24} 
          className="action-icon" 
          fill={post.isLikedByMe ? "#ed4956" : "none"} 
          color={post.isLikedByMe ? "#ed4956" : "currentColor"}
          onClick={handleLike} 
          style={{ transform: isLiking ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.2s' }}
        />
        <MessageCircle size={24} className="action-icon" />
        <Send size={24} className="action-icon" />
      </div>

      <div className="post-likes">
        {post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}
      </div>

      <div className="post-caption notranslate" translate="no">
        <span className="username notranslate" translate="no">{authorName}</span>
        {post.caption}
      </div>

      {/* Comments Section */}
      {post.comments && post.comments.length > 0 && (
        <div className="post-comments" style={{ padding: '0 14px 10px', fontSize: '14px' }}>
          {post.comments.map(c => (
            <div key={c.id} style={{ marginBottom: '4px' }}>
              <span className="username notranslate" translate="no" style={{ marginRight: '6px' }}>user_{c.user_id.substring(0,6)}</span>
              <span>{c.content}</span>
            </div>
          ))}
        </div>
      )}

      <div className="post-time">{dateStr}</div>

      {/* Add Comment Input */}
      <form onSubmit={handleComment} style={{ display: 'flex', borderTop: '1px solid var(--border-color)', padding: '10px 14px' }}>
        <input 
          type="text" 
          placeholder="Add a comment..." 
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', padding: '4px 0', fontSize: '14px', backgroundColor: 'transparent' }}
        />
        <button 
          type="submit" 
          disabled={!commentText.trim() || isCommenting}
          style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontWeight: 600, cursor: commentText.trim() ? 'pointer' : 'default', opacity: commentText.trim() ? 1 : 0.5 }}
        >
          Post
        </button>
      </form>
    </article>
  )
}

// ============== Create Post Modal ==============
function CreatePostModal({ user, onClose, onPostCreated }) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setImageFile(file)
      // Create local preview URL
      setImageUrl(URL.createObjectURL(file))
    }
  }

  async function handleSubmit() {
    if (!imageUrl && !imageFile) return
    
    setLoading(true)
    try {
      let finalImageUrl = imageUrl

      // If user selected a local file, upload it into Supabase Storage
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('post_images')
          .getPublicUrl(filePath)
        
        finalImageUrl = publicUrl
      }

      // Insert post data
      const { error } = await supabase
        .from('posts')
        .insert([{ 
          user_id: user.id, 
          image_url: finalImageUrl, 
          caption: caption 
        }])
      
      if (error) throw error
      onPostCreated()
    } catch (error) {
      alert('에러가 발생했습니다: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>새 게시물 만들기</span>
          <button className="close-btn" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="modal-body">
          {/* File Upload Hidden Input & Label Button */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <label 
              style={{ 
                flex: 1, 
                backgroundColor: '#efefef', 
                padding: '10px', 
                textAlign: 'center', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontWeight: '500',
                border: '1px solid #dbdbdb'
              }}
            >
              내 기기에서 사진 찾기 🖼️
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
              />
            </label>
          </div>
          
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
            또는 인터넷 이미지 주소(URL)를 직접 입력하세요
          </div>

          <input 
            type="text" 
            placeholder="Image URL (e.g. https://...)" 
            className="input-field"
            value={!imageFile ? imageUrl : ''} // Only show URL input if no local file selected
            onChange={e => {
              setImageFile(null)
              setImageUrl(e.target.value)
            }}
          />
          
          {imageUrl && (
             <div style={{width: '100%', height: '250px', backgroundColor: '#efefef', borderRadius: '4px', overflow: 'hidden'}}>
              <img 
                src={imageUrl} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => e.target.style.display = 'none'}
                onLoad={(e) => e.target.style.display = 'block'}
              />
            </div>
          )}
          <textarea 
            placeholder="문구 입력..." 
            className="input-field"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={(!imageUrl && !imageFile) || loading}
          >
            {loading ? '업로드 중...' : '공유하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============== Search Screen ==============
function SearchScreen({ allPosts }) {
  const [query, setQuery] = useState('')
  const filteredPosts = allPosts.filter(p => 
    (p.caption && p.caption.toLowerCase().includes(query.toLowerCase())) ||
    (p.user_id && p.user_id.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div style={{ width: '100%', maxWidth: '470px', padding: '20px 0' }}>
      <h2 style={{ marginBottom: '20px' }}>검색</h2>
      <input 
        type="text" 
        placeholder="내용 또는 작성자 ID로 검색..." 
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', outline: 'none' }}
      />
      {query.trim() === '' ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
          🔍 검색어를 입력해보세요! (내용 또는 유저ID)
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filteredPosts.length > 0 ? (
            filteredPosts.map(post => {
              const authorName = post.user_id ? `user_${String(post.user_id).substring(0,6)}` : `user_${String(post.id).substring(0,4)}`
              return (
                <div key={post.id} style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <img src={post.image_url} alt="post" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div>
                    <div className="notranslate" translate="no" style={{ fontWeight: 600, fontSize: '14px' }}>{authorName}</div>
                    <div translate="no" className="notranslate" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {post.caption?.substring(0, 40)}{post.caption?.length > 40 ? '...' : ''}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>검색 결과가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ============== Profile Screen ==============
function ProfileScreen({ user, allPosts }) {
  const [isSettingsMode, setIsSettingsMode] = useState(false)
  const [bio, setBio] = useState(user.user_metadata?.bio || '환영합니다! 이 곳은 나의 프로필 페이지입니다. 📸')
  const [tempBio, setTempBio] = useState(bio)
  const [isSaving, setIsSaving] = useState(false)

  const myPosts = allPosts.filter(p => String(p.user_id) === String(user.id))
  const username = user.email ? user.email.split('@')[0] : `user_${String(user.id).substring(0,6)}`
  const isAdmin = user.id === '99999999-9999-4999-b999-999999999999'

  const handleSettingsClick = () => {
    if (isAdmin) {
      setIsSettingsMode(true)
    } else {
      alert("이메일과 비밀번호를 입력하세요")
      setIsSettingsMode(true) // Per user's request flow: alert then enter settings
    }
  }

  const handleSaveBio = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { bio: tempBio }
      })
      if (error) throw error
      setBio(tempBio)
      setIsSettingsMode(false)
    } catch (error) {
      alert('설정 저장 중 에러가 발생했습니다: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '935px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}>
      {/* Profile Header */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '40px', width: '100%', maxWidth: '700px', alignItems: 'center' }}>
        <div style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.id}`} alt="avatar" style={{width: '100%', height: '100%', backgroundColor: '#efefef'}} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="notranslate" translate="no" style={{ fontSize: '24px', fontWeight: 400 }}>{username}</div>
            <button 
              onClick={handleSettingsClick}
              style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#efefef', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              프로필 설정
            </button>
          </div>
          <div style={{ display: 'flex', gap: '30px', fontSize: '16px' }}>
            <span>게시물 <strong>{myPosts.length}</strong></span>
            <span>팔로워 <strong>0</strong></span>
            <span>팔로우 <strong>0</strong></span>
          </div>
          
          {!isSettingsMode ? (
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <strong className="notranslate" translate="no">{username}</strong><br />
              {bio}<br />
              <span className="notranslate" translate="no" style={{color: 'var(--text-secondary)'}}>user_{String(user.id).substring(0,6)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <textarea 
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
                placeholder="자신의 소개를 입력하세요..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'none', height: '80px', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleSaveBio}
                  disabled={isSaving}
                  style={{ backgroundColor: '#0095f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button 
                  onClick={() => setIsSettingsMode(false)}
                  style={{ backgroundColor: '#efefef', border: '1px solid #dbdbdb', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Grid */}
      <div style={{ borderTop: '1px solid var(--border-color)', width: '100%', paddingTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {myPosts.map(post => (
            <div key={post.id} style={{ aspectRatio: '1/1', position: 'relative', cursor: 'pointer' }}>
              <img src={post.image_url} alt="post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div 
                style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                  backgroundColor: 'rgba(0,0,0,0.3)', opacity: 0, 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', color: 'white', fontWeight: 'bold' 
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                <span>❤️ {post.likesCount || 0}</span>
                <span>💬 {post.comments?.length || 0}</span>
              </div>
            </div>
          ))}
        </div>
        {myPosts.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
            아직 공유한 게시물이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}

export default App
