import { DataSource } from 'typeorm';
import { CourseTask, TaskType } from './course-task.entity';

/**
 * Инициализация онбординговых заданий
 * ВАЖНО: Теперь онбординг управляется через админку!
 * Эта функция вызывается только если заданий нет вообще (опционально)
 * Вызывается при первом запуске или через админку
 */
export async function initializeOnboardingTasks(dataSource: DataSource) {
  const courseTasksRepository = dataSource.getRepository(CourseTask);

  // Проверяем, не созданы ли уже онбординговые задания
  const existingTasks = await courseTasksRepository.find({
    where: { isOnboarding: true, courseId: null },
  });

  if (existingTasks.length > 0) {
    console.log('Онбординговые задания уже созданы. Используйте админку для управления.');
    return;
  }

  // Только если заданий нет вообще - создаем дефолтные (опционально)
  // Можно закомментировать этот блок, если хотите создавать задания только через админку
  console.log('⚠️ Онбординговых заданий нет. Создайте их через админку (/admin/onboarding/tasks)');
  return; // Отключаем автосоздание - теперь только через админку!
}

