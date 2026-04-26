import { useEffect, useMemo, useState } from 'react'
import api from '../utils/api'
import { AuthContext } from './AuthContextObject'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isPro, setIsPro] = useState(false)

  // Sayfa yenilemelerinde aktif kullanıcı oturumunu senkronize eder.
  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user)
        setIsPro(res.data.isPro)
      })
      .catch(() => {
        setUser(null)
        setIsPro(false)
      })
  }, [])

  const value = useMemo(
    () => ({
      user,
      isPro,
      setUser,
      setIsPro,
    }),
    [user, isPro],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
