export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 스켈레톤 */}
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded-lg w-56 mb-4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>

        {/* 계산기 선택 스켈레톤 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg">
                <div className="h-6 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-100 rounded w-full mb-3 animate-pulse"></div>
                <div className="h-8 bg-blue-200 rounded w-20 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* 계산기 입력 폼 스켈레톤 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="h-10 bg-blue-200 rounded-lg w-24 animate-pulse"></div>
            </div>
          </div>

          {/* 3D 시각화 영역 스켈레톤 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
              <div className="text-gray-400">3D 모델 로딩 중...</div>
            </div>
          </div>
        </div>

        {/* 결과 영역 스켈레톤 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="h-6 bg-gray-200 rounded w-24 mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
                <div className="h-6 bg-gray-300 rounded w-24 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}