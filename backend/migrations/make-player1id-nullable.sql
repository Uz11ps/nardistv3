-- Делаем player1Id nullable в таблице games, чтобы можно было обнулять ссылку на пользователя при удалении
-- при сохранении истории игр
ALTER TABLE "games" ALTER COLUMN "player1Id" DROP NOT NULL;

