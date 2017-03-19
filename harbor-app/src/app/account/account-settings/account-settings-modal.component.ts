import { Component, OnInit, ViewChild, AfterViewChecked } from '@angular/core';
import { NgForm } from '@angular/forms';

import { SessionUser } from '../../shared/session-user';
import { SessionService } from '../../shared/session.service';
import { MessageService } from '../../global-message/message.service';
import { AlertType, httpStatusCode } from '../../shared/shared.const';
import { errorHandler, accessErrorHandler } from '../../shared/shared.utils';
import { InlineAlertComponent } from '../../shared/inline-alert/inline-alert.component';

@Component({
    selector: "account-settings-modal",
    templateUrl: "account-settings-modal.component.html",
    styleUrls: ['../../common.css']
})

export class AccountSettingsModalComponent implements OnInit, AfterViewChecked {
    opened: boolean = false;
    staticBackdrop: boolean = true;
    account: SessionUser;
    error: any = null;
    originalStaticData: SessionUser;
    private emailTooltip: string = 'TOOLTIP.EMAIL';
    private validationStateMap: any = {
        "account_settings_email": true,
        "account_settings_full_name": true
    };
    private mailAlreadyChecked = {};

    private isOnCalling: boolean = false;
    private formValueChanged: boolean = false;
    private checkOnGoing: boolean = false;

    accountFormRef: NgForm;
    @ViewChild("accountSettingsFrom") accountForm: NgForm;
    @ViewChild(InlineAlertComponent)
    private inlineAlert: InlineAlertComponent;

    constructor(
        private session: SessionService,
        private msgService: MessageService) { }

    ngOnInit(): void {
        //Value copy
        this.account = Object.assign({}, this.session.getCurrentUser());
    }

    private getValidationState(key: string): boolean {
        return this.validationStateMap[key];
    }

    private handleValidation(key: string, flag: boolean): void {
        if (flag) {
            //Checking
            let cont = this.accountForm.controls[key];
            if (cont) {
                this.validationStateMap[key] = cont.valid;
                //Check email existing from backend
                if (cont.valid && key === "account_settings_email") {
                    if (this.formValueChanged && this.account.email != this.originalStaticData.email) {
                        if (this.mailAlreadyChecked[this.account.email]) {
                            this.validationStateMap[key] = false;
                            this.emailTooltip = "TOOLTIP.EMAIL_EXISTING";
                            return;
                        }

                        //Mail changed
                        this.checkOnGoing = true;
                        this.session.checkUserExisting("email", this.account.email)
                            .then((res: boolean) => {
                                this.checkOnGoing = false;
                                this.validationStateMap[key] = !res;
                                if (res) {
                                    this.emailTooltip = "TOOLTIP.EMAIL_EXISTING";
                                    this.mailAlreadyChecked[this.account.email] = true; //Tag it checked
                                }
                            })
                            .catch(error => {
                                this.checkOnGoing = false;
                                this.validationStateMap[key] = false;//Not valid @ backend
                            });
                    }
                }
            }
        } else {
            //Reset
            this.validationStateMap[key] = true;
            this.emailTooltip = "TOOLTIP.EMAIL";
        }
    }

    private isUserDataChange(): boolean {
        if (!this.originalStaticData || !this.account) {
            return false;
        }

        for (var prop in this.originalStaticData) {
            if (this.originalStaticData[prop]) {
                if (this.account[prop]) {
                    if (this.originalStaticData[prop] != this.account[prop]) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public get isValid(): boolean {
        return this.accountForm && this.accountForm.valid && this.error === null;
    }

    public get showProgress(): boolean {
        return this.isOnCalling;
    }

    public get checkProgress(): boolean {
        return this.checkOnGoing;
    }

    ngAfterViewChecked(): void {
        if (this.accountFormRef != this.accountForm) {
            this.accountFormRef = this.accountForm;
            if (this.accountFormRef) {
                this.accountFormRef.valueChanges.subscribe(data => {
                    if (this.error) {
                        this.error = null;
                    }
                    this.formValueChanged = true;
                    this.inlineAlert.close();
                });
            }
        }
    }

    open() {
        //Keep the initial data for future diff
        this.originalStaticData = Object.assign({}, this.session.getCurrentUser());
        this.account = Object.assign({}, this.session.getCurrentUser());
        this.formValueChanged = false;

        this.opened = true;
    }

    close() {
        if (this.formValueChanged) {
            if (!this.isUserDataChange()) {
                this.opened = false;
            } else {
                //Need user confirmation
                this.inlineAlert.showInlineConfirmation({
                    message: "ALERT.FORM_CHANGE_CONFIRMATION"
                });
            }
        } else {
            this.opened = false;
        }
    }

    submit() {
        if (!this.isValid || this.isOnCalling) {
            return;
        }

        //Double confirm session is valid
        let cUser = this.session.getCurrentUser();
        if (!cUser) {
            return;
        }

        this.isOnCalling = true;

        this.session.updateAccountSettings(this.account)
            .then(() => {
                this.isOnCalling = false;
                this.opened = false;
                this.msgService.announceMessage(200, "PROFILE.SAVE_SUCCESS", AlertType.SUCCESS);
            })
            .catch(error => {
                this.isOnCalling = false;
                this.error = error;
                if (accessErrorHandler(error, this.msgService)) {
                    this.opened = false;
                } else {
                    this.inlineAlert.showInlineError(error);
                }
            });
    }

    confirmCancel(): void {
        this.inlineAlert.close();
        this.opened = false;
    }

}