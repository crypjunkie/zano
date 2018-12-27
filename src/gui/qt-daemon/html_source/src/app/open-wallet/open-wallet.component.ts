import {Component, NgZone, OnInit} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {BackendService} from '../_helpers/services/backend.service';
import {VariablesService} from '../_helpers/services/variables.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Wallet} from '../_helpers/models/wallet.model';

@Component({
  selector: 'app-open-wallet',
  templateUrl: './open-wallet.component.html',
  styleUrls: ['./open-wallet.component.scss']
})
export class OpenWalletComponent implements OnInit {

  filePath: string;

  openForm = new FormGroup({
    name: new FormControl('', [Validators.required, (g: FormControl) => {
      for (let i = 0; i < this.variablesService.wallets.length; i++) {
        if (g.value === this.variablesService.wallets[i].name) {
          return {'duplicate': true};
        }
      }
      return null;
    }]),
    password: new FormControl('')
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private backend: BackendService,
    private variablesService: VariablesService,
    private ngZone: NgZone
  ) {
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params.path) {
        this.filePath = params.path;
        let filename = '';
        if (params.path.lastIndexOf('.') === -1) {
          filename = params.path.substr(params.path.lastIndexOf('/') + 1);
        } else {
          filename = params.path.substr(params.path.lastIndexOf('/') + 1, params.path.lastIndexOf('.') - 1 - params.path.lastIndexOf('/'));
        }
        if (filename.length > 25) {
          filename = filename.slice(0, 25);
        }
        this.openForm.get('name').setValue(filename);
      }
    });
  }

  openWallet() {
    if (this.openForm.valid) {
      this.backend.openWallet(this.filePath, this.openForm.get('password').value, false, (open_status, open_data, open_error) => {
        if (open_error && open_error === 'FILE_NOT_FOUND') {
          // var error_translate = $filter('translate')('INFORMER.SAFE_FILE_NOT_FOUND1');
          // error_translate += ':<br>' + $scope.safe.path;
          // error_translate += $filter('translate')('INFORMER.SAFE_FILE_NOT_FOUND2');
          // informer.fileNotFound(error_translate);
          alert('FILE_NOT_FOUND');
        } else {
          if (open_status || open_error === 'FILE_RESTORED') {

            let exists = false;
            this.variablesService.wallets.forEach((wallet) => {
              if (wallet.address === open_data['wi'].address) {
                exists = true;
              }
            });

            if (exists) {
              alert('SAFES.WITH_ADDRESS_ALREADY_OPEN');
              this.backend.closeWallet(open_data.wallet_id, (close_status, close_data) => {
                console.log(close_status, close_data);
                this.ngZone.run(() => {
                  this.router.navigate(['/']);
                });
              });
            } else {
              this.backend.runWallet(open_data.wallet_id, (run_status, run_data) => {
                if (run_status) {
                  const new_wallet = new Wallet(
                    open_data.wallet_id,
                    this.openForm.get('name').value,
                    this.openForm.get('password').value,
                    open_data['wi'].path,
                    open_data['wi'].address,
                    open_data['wi'].balance,
                    open_data['wi'].unlocked_balance,
                    open_data['wi'].mined_total,
                    open_data['wi'].tracking_hey
                  );
                  if (open_data.recent_history && open_data.recent_history.history) {
                    new_wallet.prepareHistory(open_data.recent_history.history);
                  }
                  this.backend.getContracts(open_data.wallet_id, (contracts_status, contracts_data) => {
                    if (contracts_status && contracts_data.hasOwnProperty('contracts')) {
                      this.ngZone.run(() => {
                        new_wallet.prepareContractsAfterOpen(contracts_data.contracts, this.variablesService.exp_med_ts, this.variablesService.height_app, this.variablesService.settings.viewedContracts, this.variablesService.settings.notViewedContracts);
                      });
                    }
                  });
                  this.variablesService.wallets.push(new_wallet);
                  this.backend.storeSecureAppData((status, data) => {
                    console.log('Store App Data', status, data);
                  });
                  this.ngZone.run(() => {
                    this.router.navigate(['/wallet/' + open_data.wallet_id]);
                  });
                } else {
                  console.log(run_data['error_code']);
                }
              });
            }
          }
        }
      });
    }
  }

}