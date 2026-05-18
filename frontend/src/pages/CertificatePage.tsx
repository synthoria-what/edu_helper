import { Award, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { Layout } from "../components/Layout";
import type { CourseDetail } from "../types";

export function CertificatePage() {
  const { courseId = "" } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);

  useEffect(() => {
    api.course(courseId).then(setCourse).catch(() => setCourse(null));
  }, [courseId]);

  return (
    <Layout>
      <div className="page-nav">
        <Link to={`/courses/${courseId}`}>
          <ChevronLeft size={18} />
          К курсу
        </Link>
      </div>
      {course?.certificate ? (
        <section className="certificate-sheet">
          <Award size={44} />
          <span>Учебный сертификат</span>
          <h1>{course.certificate.student_name}</h1>
          <p>успешно завершил(а) курс</p>
          <h2>{course.certificate.course_title}</h2>
          <div className="certificate-code">{course.certificate.code}</div>
          <small>{new Date(course.certificate.issued_at).toLocaleDateString("ru-RU")}</small>
        </section>
      ) : (
        <div className="screen-loader">Сертификат пока не оформлен</div>
      )}
    </Layout>
  );
}

