from django.urls import path

from .views import AnalyzeAllView, FitVerdictView, HealthView, ParseFileView, SkillGapView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("skill-gap/", SkillGapView.as_view(), name="skill-gap"),
    path("fit-verdict/", FitVerdictView.as_view(), name="fit-verdict"),
    path("analyze/", AnalyzeAllView.as_view(), name="analyze"),
    path("parse-file/", ParseFileView.as_view(), name="parse-file"),
]
