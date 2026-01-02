import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import './Business.css';

interface District {
  id: string;
  name: string;
  displayName: string;
}

interface Business {
  id: string;
  name: string;
  description?: string;
  businessClass: 'A' | 'B' | 'C';
  materialPackage: string;
  minLevel: number;
  requiredLicense?: string;
  district: District;
}

interface PlayerBusiness {
  id: string;
  level: number;
  narAccumulated: number;
  materialsAccumulated: number;
  lastCollectedAt: string;
  hasManager: boolean;
  managerExpiresAt?: string;
  business: Business;
}

export default function Business() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [districts, setDistricts] = useState<District[]>([]);
  const [currentDistrict, setCurrentDistrict] = useState<string>('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [playerBusinesses, setPlayerBusinesses] = useState<PlayerBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [districtsRes, businessesRes, playerBusinessesRes, locationRes] = await Promise.all([
        apiClient.get('/business/districts').catch(() => ({ data: [] })),
        apiClient.get('/business/districts/courtyards/businesses').catch(() => ({ data: [] })),
        apiClient.get('/business/my-businesses').catch(() => ({ data: [] })),
        apiClient.get('/business/location').catch(() => ({ data: null })),
      ]);

      setDistricts(districtsRes.data || []);
      setBusinesses(businessesRes.data || []);
      setPlayerBusinesses(playerBusinessesRes.data || []);
      setLocation(locationRes.data);
      if (locationRes.data) {
        setCurrentDistrict(locationRes.data.currentDistrict || 'courtyards');
      }
    } catch (error) {
      console.error('Failed to load business data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (businessId: string) => {
    try {
      await apiClient.post('/business/purchase', { businessId });
      alert('Бизнес успешно куплен!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке бизнеса');
    }
  };

  const handleUpgrade = async (playerBusinessId: string) => {
    try {
      await apiClient.post('/business/upgrade', { playerBusinessId });
      alert('Бизнес успешно улучшен!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при улучшении бизнеса');
    }
  };

  const handleCollect = async (playerBusinessId: string) => {
    try {
      const result = await apiClient.post('/business/collect', { playerBusinessId });
      alert(`Собрано: ${result.data.nar} NAR, ${result.data.materials} материалов`);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при сборе прибыли');
    }
  };

  const handleTravel = async (targetDistrict: string) => {
    try {
      await apiClient.post('/business/travel', { targetDistrict });
      alert('Перемещение начато!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при перемещении');
    }
  };

  if (loading) {
    return (
      <PageLayout title="Бизнес">
        <div className="business-loading">Загрузка...</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Бизнес">
      <div className="business-container">
        {/* Районы */}
        <div className="business-districts">
          {districts.map((district) => (
            <button
              key={district.id}
              className={`business-district-btn ${currentDistrict === district.name ? 'active' : ''}`}
              onClick={() => {
                setCurrentDistrict(district.name);
                // Загружаем бизнесы района
                apiClient.get(`/business/districts/${district.name}/businesses`).then(res => {
                  setBusinesses(res.data || []);
                });
              }}
            >
              {district.displayName}
            </button>
          ))}
        </div>

        {/* Бизнесы игрока */}
        {playerBusinesses.length > 0 && (
          <div className="business-my-businesses">
            <h3>Мои бизнесы</h3>
            <div className="business-grid">
              {playerBusinesses.map((pb) => {
                const hoursSinceCollection = pb.lastCollectedAt
                  ? Math.floor((Date.now() - new Date(pb.lastCollectedAt).getTime()) / (1000 * 60 * 60))
                  : 0;
                const canCollect = hoursSinceCollection > 0;

                return (
                  <div key={pb.id} className="business-card">
                    <div className="business-card-header">
                      <h4>{pb.business.name}</h4>
                      <span className="business-level">Уровень {pb.level}</span>
                    </div>
                    <div className="business-card-info">
                      <div>Накоплено: {Number(pb.narAccumulated)} NAR</div>
                      <div>Материалов: {Number(pb.materialsAccumulated)}</div>
                      {canCollect && (
                        <button
                          className="business-collect-btn"
                          onClick={() => handleCollect(pb.id)}
                        >
                          Собрать прибыль
                        </button>
                      )}
                      {pb.level < 10 && (
                        <button
                          className="business-upgrade-btn"
                          onClick={() => handleUpgrade(pb.id)}
                        >
                          Улучшить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Доступные бизнесы */}
        <div className="business-available">
          <h3>Доступные бизнесы</h3>
          <div className="business-grid">
            {businesses.map((business) => {
              const hasBusiness = playerBusinesses.some(pb => pb.business.id === business.id);
              const canPurchase = user?.level >= business.minLevel && !hasBusiness;

              return (
                <div key={business.id} className="business-card">
                  <div className="business-card-header">
                    <h4>{business.name}</h4>
                    <span className={`business-class business-class-${business.businessClass}`}>
                      Класс {business.businessClass}
                    </span>
                  </div>
                  <div className="business-card-info">
                    <div>Минимальный уровень: {business.minLevel}</div>
                    {business.requiredLicense && (
                      <div>Требуется лицензия: {business.requiredLicense}</div>
                    )}
                    {canPurchase && (
                      <button
                        className="business-purchase-btn"
                        onClick={() => handlePurchase(business.id)}
                      >
                        Купить
                      </button>
                    )}
                    {hasBusiness && <div className="business-owned">У вас уже есть</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

