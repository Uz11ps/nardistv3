import { DataSource } from 'typeorm';
import { CourseTask, TaskType } from './course-task.entity';

/**
 * Инициализация онбординговых заданий
 * Вызывается при первом запуске или через админку
 */
export async function initializeOnboardingTasks(dataSource: DataSource) {
  const courseTasksRepository = dataSource.getRepository(CourseTask);

  // Проверяем, не созданы ли уже онбординговые задания
  const existingTasks = await courseTasksRepository.find({
    where: { isOnboarding: true, courseId: null },
  });

  if (existingTasks.length > 0) {
    console.log('Онбординговые задания уже созданы');
    return;
  }

  // 1. Тренировка с ботом
  const trainWithBotTask = courseTasksRepository.create({
    courseId: null, // Онбординговые задания не привязаны к курсу
    type: TaskType.TRAIN_WITH_BOT,
    title: 'Пройди тренировку с ботом',
    description: 'Сыграй одну партию с ботом, чтобы научиться основам игры',
    order: 1,
    requirements: { count: 1 },
    rewardNarCoin: BigInt(500),
    rewardXP: 100,
    isRequired: true,
    isOnboarding: true,
    isActive: true,
  });

  // 2. Первая быстрая онлайн-партия
  const onlineMatchTask = courseTasksRepository.create({
    courseId: null,
    type: TaskType.ONLINE_MATCH,
    title: 'Сыграй первую онлайн-партию',
    description: 'Сыграй одну быструю партию (короткие нарды) с другим игроком',
    order: 2,
    requirements: { count: 1, mode: 'short' },
    rewardNarCoin: BigInt(1000),
    rewardXP: 200,
    isRequired: true,
    isOnboarding: true,
    isActive: true,
  });

  // 3. Просмотр экрана "Город"
  const viewCityTask = courseTasksRepository.create({
    courseId: null,
    type: TaskType.VIEW_CITY,
    title: 'Изучи город',
    description: 'Открой экран "Город" и посмотри на 7 районов',
    order: 3,
    requirements: { count: 1 },
    rewardNarCoin: BigInt(300),
    rewardXP: 50,
    isRequired: true,
    isOnboarding: true,
    isActive: true,
  });

  await courseTasksRepository.save([trainWithBotTask, onlineMatchTask, viewCityTask]);
  console.log('Онбординговые задания успешно созданы');
}

