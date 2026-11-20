import { PrismaClient } from '@prisma/client';

const DESCRIPTION =
  'Более 20-ти лет в веб-разработке: от сайтов "с нуля" на PHP до ядра международной платформы Qbix (США), где последние 10 лет отвечаю за разработку, тестирование и поддержку веб-приложений (desktop, iOS, Android), плагинов и внутренних инструментов. Веду полный цикл: фронтенд, бэкенд, API, база данных. В ежедневной практике — AI-агенты: Cursor (Claude, Grok, Composer) — постановка задач агенту, ревью и приёмка сгенерированного кода, ускорение рутины, рефакторинга и разбора legacy. Обучал новых разработчиков работе с фреймворком — есть опыт менторства и наставничества.';

const SKILLS = [
  'JavaScript',
  'HTML',
  'Git',
  'MySQL',
  'PHP',
  'Node.js',
  'Linux',
  'jQuery',
  'REST',
  'MVC',
  'JSON',
  'API',
  'Cursor',
  'Magento',
  'Web3',
  'CSS',
  'SQL',
  'Laravel',
  'Vue.js',
];

function date(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function withOrder<T>(items: T[]): (T & { sortOrder: number })[] {
  return items.map((item, sortOrder) => ({ ...item, sortOrder }));
}

const prisma = new PrismaClient();

// Сид запускается на каждом старте приложения (docker/entrypoint.sh, prestart:dev),
// поэтому по умолчанию он только заполняет пустую базу и никогда не перезаписывает
// существующие данные. `--force` возвращает прежнее поведение: очистить и залить заново.
const FORCE = process.argv.includes('--force');

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Сериализует параллельные старты (два контейнера, CI и локальный запуск сразу):
    // второй процесс ждёт коммита первого и видит уже заполненную базу. Лок снимается
    // автоматически в конце транзакции, ключ — произвольная константа. Advisory-лок
    // возвращает void, который Prisma не умеет десериализовать, поэтому он идёт в DO-блок.
    await tx.$executeRawUnsafe(
      'DO $$ BEGIN PERFORM pg_advisory_xact_lock(727001); END $$',
    );

    if (!FORCE && (await tx.profile.count()) > 0) {
      console.log(
        'seed: база уже заполнена — пропускаю (npm run db:reseed — очистить и залить заново)',
      );
      return;
    }

    await tx.achievement.deleteMany();
    await tx.experience.deleteMany();
    await tx.project.deleteMany();
    await tx.skill.deleteMany();
    await tx.profileLink.deleteMany();
    await tx.profile.deleteMany();

    await tx.profile.create({
      data: {
        name: 'Тепайкин Андрей Петрович',
        description: DESCRIPTION,
        links: {
          create: withOrder([
            { label: 'GitHub', url: 'https://github.com/AndreyTepaykin' },
            {
              label: 'LinkedIn',
              url: 'https://www.linkedin.com/in/andrey-tepaykin',
            },
            { label: 'Telegram', url: 'https://t.me/AndreyTepaykin' },
            { label: 'Email', url: 'mailto:andrey.tepaykin@gmail.com' },
          ]),
        },
        skills: {
          create: withOrder(SKILLS.map((name) => ({ name }))),
        },
        projects: {
          create: withOrder([
            {
              name: 'Laravel + Vue demo',
              url: 'https://laravel-vue-demo.laravel.cloud',
            },
            {
              name: 'Qbix Communities plugin',
              url: 'https://github.com/Qbix/Communities',
            },
            {
              name: 'Qbix Travel plugin',
              url: 'https://github.com/Qbix/Travel',
            },
            {
              name: 'Qbix Assets plugin',
              url: 'https://github.com/Qbix/Assets',
            },
            {
              name: 'GBA Global Conference App',
              url: 'https://gba.community/',
            },
            {
              name: 'Intercoin community application',
              url: 'https://intercoin.app/',
            },
            {
              name: 'DeepSeek Harness sidebar pins',
              url: 'https://github.com/AndreyTepaykin/dsh-sidebar-pins',
            },
            { name: 'Dishes', url: 'https://dishes.at/' },
            {
              name: 'MCP server for the hh.ru API',
              url: 'https://github.com/AndreyTepaykin/hh-mcp',
            },
          ]),
        },
        experiences: {
          create: [
            {
              company: 'Qbix Inc.',
              position: 'Platform director',
              startDate: date(2016, 8),
              endDate: date(2026, 8),
              companyUrl: 'https://qbix.com/',
              sortOrder: 0,
              achievements: {
                create: withOrder([
                  {
                    text: 'Разработка и тестирование веб-приложений на фреймворке Qbix под desktop, iOS и Android.',
                  },
                  {
                    text: 'Плагин Travel — построение автомобильного маршрута с возможностью добавления промежуточных точек; стек: Google Places API, jQuery, Qbix.',
                  },
                  {
                    text: 'Плагин Assets — покупка токенов через Stripe, оплата внутренних сервисов, отправка токенов другим пользователям.',
                  },
                  {
                    text: 'Плагин Calendars — календари и события: разовые и повторяющиеся события, слоты доступности, участие и чек-ин, напоминания, оплата, место и видеосвязь, подписка и экспорт в Google Calendar, Outlook и ICS.',
                  },
                  {
                    text: 'Плагин Communities — готовый каркас сообщества поверх Users, Streams, Places и Calendars: несколько сообществ, дашборд, люди, события, услуги, переписки, профили, онбординг и импорт пользователей.',
                  },
                  { text: 'Исправление и развитие ядра фреймворка.' },
                  {
                    text: 'Обучение и онбординг новых разработчиков работе с фреймворком: обучающие видео и онлайн-обучение.',
                  },
                  {
                    text: 'AI-агент Cursor (Claude, Grok) в ежедневном цикле: ускорение задач, рефакторинг, тесты, разбор незнакомого кода — с обязательным ревью результата.',
                  },
                ]),
              },
            },
            {
              company: 'Upwork',
              position: 'Веб-разработчик',
              startDate: date(2009, 8),
              endDate: date(2016, 8),
              sortOrder: 1,
              achievements: {
                create: withOrder([
                  {
                    text: 'Разработка веб-сайтов под заказ: фронтенд, бэкенд, GUI, REST.',
                  },
                  {
                    text: 'Стек: PHP, JavaScript, MySQL, CSS, HTML; osCommerce, Shopify, Joomla, CodeIgniter, Magento.',
                  },
                ]),
              },
            },
            {
              company: 'Freelance',
              position: 'Веб-разработчик',
              startDate: date(2001, 8),
              endDate: date(2009, 8),
              sortOrder: 2,
              achievements: {
                create: withOrder([
                  {
                    text: 'Веб-разработка и дизайн сайтов для малого бизнеса и стартапов: osCommerce, Magento.',
                  },
                ]),
              },
            },
            {
              company: 'ОАО Связьинформ',
              position: 'Веб-мастер',
              startDate: date(1997, 8),
              endDate: date(2001, 8),
              sortOrder: 3,
              achievements: {
                create: withOrder([
                  {
                    text: 'Создание сайтов с нуля (Perl, PHP, PostgreSQL, JS, CSS, HTML).',
                  },
                ]),
              },
            },
          ],
        },
      },
    });
    // Дефолтные 5 с рассчитаны на локальную базу. Сид по внешней managed-базе
    // (Render) — это ~40 round-trip'ов, поэтому лимит увеличен.
  }, { timeout: 60_000, maxWait: 15_000 });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
