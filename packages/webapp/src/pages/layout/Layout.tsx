import { Outlet, NavLink, Link } from 'react-router-dom';

import github from '../../assets/github.svg';

import styles from './Layout.module.css';

const Layout = () => {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <Link to="/" className={styles.headerTitleContainer}>
            <h3 className={styles.headerTitle}>KI-Wahl-o-mat</h3>
          </Link>
          <nav>
            <ul className={styles.headerNavList}>
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                >
                  Chat
                </NavLink>
              </li>
              <li className={styles.headerNavLeftMargin}>
                <NavLink
                  to="/qa"
                  className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                >
                  Stelle eine Frage
                </NavLink>
              </li>
              <li className={styles.headerNavLeftMargin}>
                <a
                  href="https://github.com/joshuaheller/ki-wahlomat"
                  target={'_blank'}
                  title="Github repository (Open-Source)"
                  rel="noreferrer"
                >
                  <img
                    src={github}
                    alt="Github logo"
                    aria-label="Azure OpenAI JavaScript Github repository link"
                    width="20px"
                    height="20px"
                    className={styles.githubLogo}
                  />
                </a>
              </li>
            </ul>
          </nav>
          <h4 className={styles.headerRightText}>The AI Software Company</h4>
        </div>
      </header>

      <Outlet />
    </div>
  );
};

export default Layout;
