import { Component, ReactNode } from 'react'
import { BACKUP_KEY, SAVE_KEY } from '../persistence'
import { TIMER_KEY } from '../timer'

interface Props {
  children: ReactNode
}
interface State {
  error?: Error
}

// 렌더 크래시가 나면 흰 화면 대신 복구 UI를 보여준다.
// 세이브는 localStorage에 그대로 남아 있으므로보내기/새로고침으로 살릴 수 있다.
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  private exportSave = () => {
    const raw = localStorage.getItem('quest-do-save-v1') ?? '{}'
    const blob = new Blob([raw], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ilta-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  private resetSave = () => {
    if (!confirm('세이브를 지우고 처음부터 시작할까요? (보내기로 백업 권장)')) return
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(BACKUP_KEY)
    localStorage.removeItem(TIMER_KEY)
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-screen">
        <div className="pixel-panel error-card">
          <div className="error-title">💥 게임이 멈췄어요</div>
          <p className="dim">
            세이브 데이터는 그대로 남아 있어요. 새로고침으로 대부분 복구되고, 안 되면 세이브를 보내서 보관한
            뒤 초기화하세요.
          </p>
          <pre className="error-log">{String(this.state.error.message ?? this.state.error)}</pre>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            새로고침
          </button>
          <button className="btn btn-sub" onClick={this.exportSave}>
            📦 세이브보내기
          </button>
          <button className="btn btn-ghost" onClick={this.resetSave}>
            세이브 초기화
          </button>
        </div>
      </div>
    )
  }
}
