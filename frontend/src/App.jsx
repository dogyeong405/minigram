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
      // Admin session check from local storage (so it survives refresh)
      const localAdmin = localStorage.getItem('minigram_admin_session')
      if (localAdmin === 'true') {
        const adminMeta = JSON.parse(localStorage.getItem('minigram_admin_metadata') || '{}')
        setSession({
          user: {
            id: '99999999-9999-4999-b999-999999999999',
            email: 'admin@minigram.com',
            user_metadata: adminMeta
          }
        })
        fetchPosts('99999999-9999-4999-b999-999999999999')
        setLoading(false)
        return
      }
      
      setSession(session)
      if (session) fetchPosts(session.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const localAdmin = localStorage.getItem('minigram_admin_session')
      if (localAdmin === 'true') return // Ignore Supabase events if admin session is overriding
      
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
        const adminLikes = JSON.parse(localStorage.getItem('minigram_admin_likes') || '[]')
        const isAdmin = userId === '99999999-9999-4999-b999-999999999999'

        const processedPosts = postsData.map(post => {
          const postLikes = likesData?.filter(l => l.post_id === post.id) || []
          const postComments = commentsData?.filter(c => c.post_id === post.id) || []
          
          let isLiked = postLikes.some(l => l.user_id === userId)
          let count = postLikes.length

          // Inject admin likes locally to persist mock state
          if (isAdmin && adminLikes.includes(post.id)) {
            isLiked = true
            count += 1
          }

          return {
            ...post,
            likesCount: count,
            isLikedByMe: isLiked,
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
      localStorage.setItem('minigram_admin_session', 'true')
      const adminMeta = JSON.parse(localStorage.getItem('minigram_admin_metadata') || '{}')
      const userObj = { ...adminUser.user, user_metadata: adminMeta }
      setSession({ user: userObj })
      fetchPosts(userObj.id)
    }} />
  }

  const isAdmin = session.user.id === '99999999-9999-4999-b999-999999999999'
  const needsOnboarding = !isAdmin && !session.user.user_metadata?.username

  if (needsOnboarding) {
    return <OnboardingModal 
      user={session.user} 
      onComplete={(data) => {
        setSession({
          ...session,
          user: {
            ...session.user,
            user_metadata: {
              ...(session.user.user_metadata || {}),
              username: data.username,
              bio: data.bio
            }
          }
        })
      }} 
    />
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
              localStorage.removeItem('minigram_admin_session')
              setSession(null)
              setCurrentView('home')
            }
          }}>
             <LogOut size={24} />
             <span translate="no" className="nav-text notranslate">로그아웃</span>
          </div>
          <div className={`nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => setCurrentView('profile')}>
            <div className="avatar" style={{width: 24, height: 24, padding: 0}}>
               <img src={session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${session.user.id}`} alt="my profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
        {currentView === 'search' && <SearchScreen allPosts={posts} currentUser={session.user} />}
        {currentView === 'profile' && <ProfileScreen user={session.user} allPosts={posts} setSession={setSession} />}
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
  const [showCommentInput, setShowCommentInput] = useState(false)

  // Local state for optimistic UI updates
  const [localIsLiked, setLocalIsLiked] = useState(post.isLikedByMe)
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount || 0)

  useEffect(() => {
    if (!isLiking) {
      setLocalIsLiked(post.isLikedByMe)
      setLocalLikesCount(post.likesCount || 0)
    }
  }, [post.isLikedByMe, post.likesCount])

  const handleLike = async () => {
    if (isLiking) return
    setIsLiking(true)
    
    const previousIsLiked = localIsLiked
    const previousLikesCount = localLikesCount

    // Optimistic UI change
    setLocalIsLiked(!previousIsLiked)
    setLocalLikesCount(prev => previousIsLiked ? prev - 1 : prev + 1)

    // Admin bypass: Skip DB call as admin ID violates foreign keys
    if (currentUser?.id === '99999999-9999-4999-b999-999999999999') {
      const storedLikes = JSON.parse(localStorage.getItem('minigram_admin_likes') || '[]')
      if (!previousIsLiked) {
        if (!storedLikes.includes(post.id)) storedLikes.push(post.id)
      } else {
        const index = storedLikes.indexOf(post.id)
        if (index !== -1) storedLikes.splice(index, 1)
      }
      localStorage.setItem('minigram_admin_likes', JSON.stringify(storedLikes))
      setTimeout(() => setIsLiking(false), 300)
      return
    }

    try {
      if (previousIsLiked) {
        // Unlike
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUser.id })
      } else {
        // Like
        await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser.id }])
      }
      onInteract() // Refresh data
    } catch (error) {
      console.error('Error toggling like:', error)
      // Rollback optimistic update
      setLocalIsLiked(previousIsLiked)
      setLocalLikesCount(previousLikesCount)
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
  let authorName = post.user_id ? `user_${post.user_id.substring(0,6)}` : `user_${post.id?.toString().substring(0,4)}`
  let authorAvatar = post.user_id ? `https://api.dicebear.com/7.x/notionists/svg?seed=${post.user_id}` : `https://api.dicebear.com/7.x/notionists/svg?seed=${post.id}`
  
  if (currentUser && post.user_id === currentUser.id) {
    if (currentUser.user_metadata?.username) authorName = currentUser.user_metadata.username
    if (currentUser.user_metadata?.avatar_url) authorAvatar = currentUser.user_metadata.avatar_url
  }

  return (
    <article className="post">
      <div className="post-header">
        <div className="avatar">
          <img src={authorAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <span className="username notranslate" translate="no">{authorName}</span>
        <MoreHorizontal size={20} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
      </div>

      <img src={post.image_url} alt="Post content" className="post-image" />

      {post.caption && (
        <div className="post-caption notranslate" translate="no">
          {post.caption}
        </div>
      )}

      <div className="post-actions">
        <Heart 
          size={24} 
          className="action-icon" 
          fill={localIsLiked ? "#ed4956" : "none"} 
          color={localIsLiked ? "#ed4956" : "currentColor"}
          onClick={handleLike} 
          style={{ transform: isLiking ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.2s', cursor: 'pointer' }}
        />
        <MessageCircle size={24} className="action-icon" onClick={() => setShowCommentInput(prev => !prev)} style={{ cursor: 'pointer' }} />
        <Send size={24} className="action-icon" style={{ cursor: 'pointer' }} />
      </div>

      <div className="post-likes">
        {localLikesCount} likes
      </div>

      {/* Comments Section */}
      {post.comments && post.comments.length > 0 && (
        <div className="post-comments" style={{ padding: '0 14px 10px', fontSize: '14px' }}>
          {post.comments.map(c => {
            let commentAuthor = `user_${c.user_id.substring(0,6)}`
            let commentAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${c.user_id}`
            
            if (currentUser && c.user_id === currentUser.id) {
              if (currentUser.user_metadata?.username) commentAuthor = currentUser.user_metadata.username
              if (currentUser.user_metadata?.avatar_url) commentAvatar = currentUser.user_metadata.avatar_url
            }
            return (
              <div key={c.id} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={commentAvatar} alt="cmt-avatar" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                <span className="username notranslate" translate="no">{commentAuthor}</span>
                <span>{c.content}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="post-time">{dateStr}</div>

      {/* Add Comment Input */}
      {showCommentInput && (
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
      )}
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
function SearchScreen({ allPosts, currentUser }) {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('post') // 'post' or 'user'

  const filteredPosts = allPosts.filter(p => 
    p.caption && p.caption.toLowerCase().includes(query.toLowerCase())
  )

  const uniqueUsers = []
  const seen = new Set()
  allPosts.forEach(p => {
    if (!seen.has(p.user_id)) {
      seen.add(p.user_id)
      let uName = p.user_id ? `user_${String(p.user_id).substring(0,6)}` : `user_${String(p.id).substring(0,4)}`
      let uAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${p.user_id || p.id}`
      
      if (currentUser && p.user_id === currentUser.id) {
        if (currentUser.user_metadata?.username) uName = currentUser.user_metadata.username
        if (currentUser.user_metadata?.avatar_url) uAvatar = currentUser.user_metadata.avatar_url
      }
      uniqueUsers.push({ id: p.user_id, username: uName, avatar_url: uAvatar })
    }
  })

  // Add currentUser manually if not in uniqueUsers (so you can find yourself even with 0 posts)
  if (currentUser && !seen.has(currentUser.id)) {
    let selfName = currentUser.user_metadata?.username || `user_${String(currentUser.id).substring(0,6)}`
    let selfAvatar = currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${currentUser.id}`
    uniqueUsers.push({ id: currentUser.id, username: selfName, avatar_url: selfAvatar })
  }

  const matchedUsers = uniqueUsers.filter(u => u.username.toLowerCase().includes(query.toLowerCase()))

  return (
    <div style={{ width: '100%', maxWidth: '470px', padding: '20px 0' }}>
      <h2 style={{ marginBottom: '20px' }}>검색</h2>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          onClick={() => setSearchType('post')}
          style={{ flex: 1, padding: '10px', border: 'none', borderBottom: searchType === 'post' ? '2px solid black' : '2px solid transparent', backgroundColor: 'transparent', fontWeight: searchType === 'post' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}
        >
          게시물 검색
        </button>
        <button 
          onClick={() => setSearchType('user')}
          style={{ flex: 1, padding: '10px', border: 'none', borderBottom: searchType === 'user' ? '2px solid black' : '2px solid transparent', backgroundColor: 'transparent', fontWeight: searchType === 'user' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}
        >
          사용자 검색
        </button>
      </div>

      <input 
        type="text" 
        placeholder={searchType === 'post' ? "내용으로 게시물 검색..." : "아이디로 사용자 검색..."}
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '15px', outline: 'none' }}
      />

      {query.trim() === '' ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
          🔍 검색어를 입력해보세요!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {searchType === 'post' && (
            filteredPosts.length > 0 ? (
              filteredPosts.map(post => {
                let authorName = post.user_id ? `user_${String(post.user_id).substring(0,6)}` : `user_${String(post.id).substring(0,4)}`
                if (currentUser && post.user_id === currentUser.id && currentUser.user_metadata?.username) {
                  authorName = currentUser.user_metadata.username
                }
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
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>게시물 검색 결과가 없습니다.</div>
            )
          )}

          {searchType === 'user' && (
            matchedUsers.length > 0 ? (
              matchedUsers.map(u => (
                <div key={u.id} style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => alert('프로필 보기 기능은 준비 중입니다!')}>
                  <img src={u.avatar_url} alt="user" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%' }} />
                  <div className="notranslate" translate="no" style={{ fontWeight: 600, fontSize: '14px' }}>
                    {u.username}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>사용자 검색 결과가 없습니다.</div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ============== Onboarding Modal ==============
function OnboardingModal({ user, onComplete }) {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('환영합니다! 이 곳은 나의 프로필 페이지입니다. 📸')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!username.trim()) {
      alert('아이디를 입력해주세요!')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username: username.trim(), bio: bio.trim() }
      })
      if (error) throw error
      onComplete({ username: username.trim(), bio: bio.trim() })
    } catch (err) {
      alert('저장 중 에러가 발생했습니다: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px', padding: '30px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>환영합니다! 🎉</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px', color: '#666' }}>
          Minigram에서 사용할 아이디와 자신의 소개를 입력해주세요!
        </p>

        <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>아이디</label>
        <input 
          type="text" 
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="사용할 아이디 입력"
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dbdbdb', marginBottom: '15px', outline: 'none' }} 
        />

        <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>소개 (Bio)</label>
        <textarea 
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="자신의 소개를 입력하세요..."
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dbdbdb', resize: 'none', height: '80px', marginBottom: '20px', outline: 'none' }}
        />

        <button 
          onClick={handleSubmit} 
          disabled={loading}
          style={{ width: '100%', padding: '12px', backgroundColor: '#0095f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  )
}

// ============== Profile Settings Modal ==============
function ProfileSettingsModal({ user, currentUsername, currentBio, currentAvatarUrl, isAdmin, onClose, onSave }) {
  const [username, setUsername] = useState(currentUsername)
  const [bio, setBio] = useState(currentBio)
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [avatarFile, setAvatarFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setAvatarFile(file)
      setAvatarUrl(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    setLoading(true)
    let finalAvatarUrl = avatarUrl

    if (avatarFile) {
      if (isAdmin) {
        // Mock upload using Base64 for the guest/admin account
        const reader = new FileReader()
        reader.readAsDataURL(avatarFile)
        await new Promise(resolve => {
          reader.onload = () => {
            finalAvatarUrl = reader.result
            resolve()
          }
        })
      } else {
        // Upload to Supabase Storage for actual users
        try {
          const fileExt = avatarFile.name.split('.').pop()
          const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`
          const { error: uploadError } = await supabase.storage.from('post_images').upload(fileName, avatarFile)
          if (uploadError) throw uploadError
          const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(fileName)
          finalAvatarUrl = publicUrl
        } catch (e) {
          alert('프로필 사진 업로드 실패: ' + e.message)
          setLoading(false)
          return
        }
      }
    }

    await onSave(username, bio, finalAvatarUrl)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 'bold' }}>프로필 설정</span>
          <button className="close-btn" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <img src={avatarUrl} alt="preview" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #dbdbdb' }} />
            <label style={{ cursor: 'pointer', color: '#0095f6', fontWeight: 'bold', fontSize: '14px' }}>
              프로필 사진 바꾸기
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </label>
          </div>

          <div>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>사용자 아이디</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              disabled={!isAdmin} 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dbdbdb', backgroundColor: !isAdmin ? '#f0f0f0' : 'white', color: !isAdmin ? '#888' : 'black', outline: 'none' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>소개 (Bio)</label>
            <textarea 
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="자신의 소개를 입력하세요..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dbdbdb', resize: 'none', height: '100px', outline: 'none' }}
            />
          </div>
          
          <button 
            onClick={handleSave}
            disabled={loading}
            style={{ backgroundColor: '#0095f6', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============== Profile Screen ==============
function ProfileScreen({ user, allPosts, setSession }) {
  const [isSettingsMode, setIsSettingsMode] = useState(false)
  
  const isAdmin = user.id === '99999999-9999-4999-b999-999999999999'
  const defaultUsername = `user_${String(user.id).substring(0,6)}`
  
  const [username, setUsername] = useState(user.user_metadata?.username || defaultUsername)
  const [bio, setBio] = useState(user.user_metadata?.bio || '환영합니다! 이 곳은 나의 프로필 페이지입니다. 📸')
  const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user.id}`)

  const myPosts = allPosts.filter(p => String(p.user_id) === String(user.id))

  const handleSettingsClick = () => {
    setIsSettingsMode(true)
  }

  const handleSaveSettings = async (newUsername, newBio, newAvatarUrl) => {
    if (isAdmin) {
      setUsername(newUsername)
      setBio(newBio)
      setAvatarUrl(newAvatarUrl)
      const newMeta = { username: newUsername, bio: newBio, avatar_url: newAvatarUrl }
      localStorage.setItem('minigram_admin_metadata', JSON.stringify(newMeta))
      if (setSession) {
        setSession(prev => ({
          ...prev,
          user: { ...prev.user, user_metadata: newMeta }
        }))
      }
      setIsSettingsMode(false)
      return
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: { bio: newBio, avatar_url: newAvatarUrl }
      })
      if (error) throw error
      setBio(newBio)
      setAvatarUrl(newAvatarUrl)
      setIsSettingsMode(false)
    } catch (error) {
      alert('설정 저장 중 에러가 발생했습니다: ' + error.message)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '935px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}>
      {/* Profile Header */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '40px', width: '100%', maxWidth: '700px', alignItems: 'center' }}>
        <div style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
          <img src={avatarUrl} alt="avatar" style={{width: '100%', height: '100%', backgroundColor: '#efefef', objectFit: 'cover'}} />
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
          
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            <strong className="notranslate" translate="no">{username}</strong><br />
            {bio}
          </div>
        </div>
      </div>
      
      {isSettingsMode && (
        <ProfileSettingsModal 
          user={user} 
          currentUsername={username}
          currentBio={bio} 
          currentAvatarUrl={avatarUrl}
          isAdmin={isAdmin}
          onClose={() => setIsSettingsMode(false)} 
          onSave={handleSaveSettings} 
        />
      )}

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
