from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import UserResponse, UserProfileUpdate
from app.repositories.user import UserRepository
from app.routes.auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Fetch current user's profile information."""
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends()
):
    """Update current user's profile information."""
    updated_user = await user_repo.update_profile(
        user_id=current_user["id"],
        update_data=profile_data.model_dump(exclude_unset=True)
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update profile"
        )
    return updated_user

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends()
):
    """Fetch profile information for a specific user (public details)."""
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

